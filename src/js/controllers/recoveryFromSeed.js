

angular.module('copayApp.controllers').controller('recoveryFromSeed',
	function ($rootScope, $scope, $log, $timeout, profileService, isCordova) {
  const async = require('async');
  const conf = require('byteballcore/conf.js');
  const wallet_defined_by_keys = require('byteballcore/wallet_defined_by_keys.js');
  const objectHash = require('byteballcore/object_hash.js');
  try {
    var ecdsa = isCordova ? null : require('secp256k1' + '');
  }		catch (e) {
    var ecdsa = require('byteballcore/node_modules/secp256k1' + '');
  }
  const Mnemonic = require('bitcore-mnemonic');
  const Bitcore = require('bitcore-lib');
  const db = require('byteballcore/db.js');

  const self = this;

  self.error = '';
  self.bLight = conf.bLight;
  self.scanning = false;
  self.inputMnemonic = '';
  self.xPrivKey = '';
  self.assocIndexesToWallets = {};

  function determineIfAddressUsed(address, cb) {
    db.query('SELECT 1 FROM outputs WHERE address = ? LIMIT 1', [address], (outputsRows) => {
      if (outputsRows.length === 1) { cb(true); } else {
        db.query('SELECT 1 FROM unit_authors WHERE address = ? LIMIT 1', [address], (unitAuthorsRows) => {
          cb(unitAuthorsRows.length === 1);
        });
      }
    });
  }

  function scanForAddressesAndWallets(mnemonic, cb) {
    self.xPrivKey = new Mnemonic(mnemonic).toHDPrivateKey();
    let xPubKey;
    let lastUsedAddressIndex = -1;
    let lastUsedWalletIndex = -1;
    let currentAddressIndex = 0;
    let currentWalletIndex = 0;
    const arrWalletIndexes = [];
    const assocMaxAddressIndexes = {};

    function checkAndAddCurrentAddress(is_change) {
      const address = objectHash.getChash160(['sig', { pubkey: wallet_defined_by_keys.derivePubkey(xPubKey, `m/${is_change}/${currentAddressIndex}`) }]);
      determineIfAddressUsed(address, (bUsed) => {
        if (bUsed) {
          lastUsedAddressIndex = currentAddressIndex;
          if (!assocMaxAddressIndexes[currentWalletIndex]) assocMaxAddressIndexes[currentWalletIndex] = { main: 0 };
          if (is_change) {
            assocMaxAddressIndexes[currentWalletIndex].change = currentAddressIndex;
          } else {
            assocMaxAddressIndexes[currentWalletIndex].main = currentAddressIndex;
          }
          currentAddressIndex++;
          checkAndAddCurrentAddress(is_change);
        } else {
          currentAddressIndex++;
          if (currentAddressIndex - lastUsedAddressIndex >= 20) {
            if (is_change) {
              if (lastUsedAddressIndex !== -1) {
                lastUsedWalletIndex = currentWalletIndex;
                arrWalletIndexes.push(currentWalletIndex);
              }
              if (currentWalletIndex - lastUsedWalletIndex >= 20) {
                cb(assocMaxAddressIndexes, arrWalletIndexes);
              } else {
                currentWalletIndex++;
                setCurrentWallet();
              }
            } else {
              currentAddressIndex = 0;
              checkAndAddCurrentAddress(1);
            }
          } else {
            checkAndAddCurrentAddress(is_change);
          }
        }
      });
    }

    function setCurrentWallet() {
      xPubKey = Bitcore.HDPublicKey(self.xPrivKey.derive(`m/44'/0'/${currentWalletIndex}'`));
      lastUsedAddressIndex = -1;
      currentAddressIndex = 0;
      checkAndAddCurrentAddress(0);
    }

    setCurrentWallet();
  }

  function removeAddressesAndWallets(cb) {
    const arrQueries = [];
    db.addQuery(arrQueries, 'DELETE FROM pending_shared_address_signing_paths');
    db.addQuery(arrQueries, 'DELETE FROM shared_address_signing_paths');
    db.addQuery(arrQueries, 'DELETE FROM pending_shared_addresses');
    db.addQuery(arrQueries, 'DELETE FROM shared_addresses');
    db.addQuery(arrQueries, 'DELETE FROM my_addresses');
    db.addQuery(arrQueries, 'DELETE FROM wallet_signing_paths');
    db.addQuery(arrQueries, 'DELETE FROM extended_pubkeys');
    db.addQuery(arrQueries, 'DELETE FROM wallets');
    db.addQuery(arrQueries, 'DELETE FROM correspondent_devices');

    async.series(arrQueries, cb);
  }

  function createAddresses(assocMaxAddressIndexes, cb) {
    const accounts = Object.keys(assocMaxAddressIndexes);
    let currentAccount = 0;

    function addAddress(wallet, is_change, index, maxIndex) {
      wallet_defined_by_keys.issueAddress(wallet, is_change, index, (addressInfo) => {
        index++;
        if (index <= maxIndex) {
          addAddress(wallet, is_change, index, maxIndex);
        } else if (is_change) {
          currentAccount++;
          (currentAccount < accounts.length) ? startAddToNewWallet(0) : cb();
        } else {
          startAddToNewWallet(1);
        }
      });
    }

    function startAddToNewWallet(is_change) {
      if (is_change) {
        if (assocMaxAddressIndexes[accounts[currentAccount]].change !== undefined) {
          addAddress(self.assocIndexesToWallets[accounts[currentAccount]], 1, 0, assocMaxAddressIndexes[accounts[currentAccount]].change);
        } else {
          currentAccount++;
          (currentAccount < accounts.length) ? startAddToNewWallet(0) : cb();
        }
      } else {
        addAddress(self.assocIndexesToWallets[accounts[currentAccount]], 0, 0, assocMaxAddressIndexes[accounts[currentAccount]].main + 20);
      }
    }


    startAddToNewWallet(0);
  }

  function createWallets(arrWalletIndexes, cb) {
    function createWallet(n) {
      const account = parseInt(arrWalletIndexes[n]);
      const opts = {};
      opts.m = 1;
      opts.n = 1;
      opts.name = `Wallet #${account}`;
      opts.network = 'livenet';
      opts.cosigners = [];
      opts.extendedPrivateKey = self.xPrivKey;
      opts.mnemonic = self.inputMnemonic;
      opts.account = account;

      profileService.createWallet(opts, (err, walletId) => {
        self.assocIndexesToWallets[account] = walletId;
        n++;
        (n < arrWalletIndexes.length) ? createWallet(n) : cb();
      });
    }

    createWallet(0);
  }

  self.recoveryForm = function () {
    if (self.inputMnemonic) {
      if ((self.inputMnemonic.split(' ').length % 3 === 0) && Mnemonic.isValid(self.inputMnemonic)) {
        self.scanning = true;
        scanForAddressesAndWallets(self.inputMnemonic, (assocMaxAddressIndexes, arrWalletIndexes) => {
          if (arrWalletIndexes.length) {
            removeAddressesAndWallets(() => {
              const myDeviceAddress = objectHash.getDeviceAddress(ecdsa.publicKeyCreate(self.xPrivKey.derive("m/1'").privateKey.bn.toBuffer({ size: 32 }), true).toString('base64'));
              profileService.replaceProfile(self.xPrivKey.toString(), self.inputMnemonic, myDeviceAddress, () => {
                createWallets(arrWalletIndexes, () => {
                  createAddresses(assocMaxAddressIndexes, () => {
                    self.scanning = false;
                    $rootScope.$emit('Local/ShowAlert', `${arrWalletIndexes.length} wallets recovered, please restart the application to finish.`, 'fi-check', () => {
                    if (navigator && navigator.app) // android
                    navigator.app.exitApp();
                    else if (process.exit) // nwjs
                    process.exit();
                  });
                  });
                });
              });
            });
          } else {
            self.error = 'No active addresses found.';
            self.scanning = false;
            $timeout(() => {
              $rootScope.$apply();
            });
          }
        });
      } else {
        self.error = 'Seed is not valid';
      }
    }
  };
});
