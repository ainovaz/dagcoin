/** @namespace Client.API */


if (process.browser) {
  const conf = require('byteballcore/conf.js');
  const appPackageJson = require('../../../package.json');
  conf.program = appPackageJson.name;
  conf.program_version = appPackageJson.version;
}

let walletDefinedByKeys;
var ecdsaSig = require('byteballcore/signature.js');
var breadcrumbs = require('byteballcore/breadcrumbs.js');
var constants = require('byteballcore/constants.js');

const isTestnet = constants.version.match(/t$/);
constants.DAGCOIN_ASSET = isTestnet ? 'B9dw3C3gMC+AODL/XqWjFh9jFe31jS08yf2C3zl8XGg=' : 'j5brqzPhQ0H2VNYi3i59PmlV15p54yAiSzacrQ2KqQQ=';

const _ = require('lodash');
const $ = require('preconditions').singleton();
const util = require('util');
const events = require('events');
const Bitcore = require('bitcore-lib');

const Common = require('./common');

const Constants = Common.Constants;

const log = require('./log');
const Credentials = require('./credentials');
const Errors = require('./errors/errordefinitions');


/**
 * @desc ClientAPI constructor.
 *
 * @param {Object} opts
 * @constructor
 */
function API(opts) {
  opts = opts || {};
  this.verbose = !!opts.verbose;
  this.timeout = opts.timeout || 50000;
  walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');

  if (this.verbose) { log.setLevel('debug'); } else		{ log.setLevel('info'); }
}
util.inherits(API, events.EventEmitter);

API.privateKeyEncryptionOpts = {
  iter: 10000,
};


API.prototype.initialize = function (opts, cb) {
  $.checkState(this.credentials);


  return cb();
};


/**
 * Seed from random
 *
 * @param {Object} opts
 * @param {String} opts.network - default 'livenet'
 */
API.prototype.seedFromRandom = function (opts) {
  $.checkArgument(arguments.length <= 1, 'DEPRECATED: only 1 argument accepted.');
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: argument should be an options object.');

  opts = opts || {};
  this.credentials = Credentials.create(opts.network || 'livenet', opts.account || 0);
};

/**
 * Seed from random with mnemonic
 *
 * @param {Object} opts
 * @param {String} opts.network - default 'livenet'
 * @param {String} opts.passphrase
 * @param {Number} opts.language - default 'en'
 * @param {Number} opts.account - default 0
 */
API.prototype.seedFromRandomWithMnemonic = function (opts) {
  $.checkArgument(arguments.length <= 1, 'DEPRECATED: only 1 argument accepted.');
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: argument should be an options object.');

  opts = opts || {};
  console.log(`client: seedFromRandomWithMnemonic ${JSON.stringify(opts)}`);
  this.credentials = Credentials.createWithMnemonic(opts.network || 'livenet', opts.passphrase, opts.language || 'en', opts.account || 0);
};

API.prototype.getMnemonic = function () {
  return this.credentials.getMnemonic();
};

API.prototype.mnemonicHasPassphrase = function () {
  return this.credentials.mnemonicHasPassphrase;
};


API.prototype.clearMnemonic = function () {
  return this.credentials.clearMnemonic();
};


/**
 * Seed from extended private key
 *
 * @param {String} xPrivKey
 */
API.prototype.seedFromExtendedPrivateKey = function (xPrivKey, account) {
  this.credentials = Credentials.fromExtendedPrivateKey(xPrivKey, account);
};


/**
 * Seed from Mnemonics (language autodetected)
 * Can throw an error if mnemonic is invalid
 *
 * @param {String} BIP39 words
 * @param {Object} opts
 * @param {String} opts.network - default 'livenet'
 * @param {String} opts.passphrase
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.seedFromMnemonic = function (words, opts) {
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts), 'DEPRECATED: second argument should be an options object.');

  opts = opts || {};
  this.credentials = Credentials.fromMnemonic(opts.network || 'livenet', words, opts.passphrase, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
};

/**
 * Seed from external wallet public key
 *
 * @param {String} xPubKey
 * @param {String} source - A name identifying the source of the xPrivKey (e.g. ledger, TREZOR, ...)
 * @param {String} entropySourceHex - A HEX string containing pseudo-random data, that can be deterministically derived from the xPrivKey, and should not be derived from xPubKey.
 * @param {Object} opts
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.seedFromExtendedPublicKey = function (xPubKey, source, entropySourceHex, opts) {
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts));

  opts = opts || {};
  this.credentials = Credentials.fromExtendedPublicKey(xPubKey, source, entropySourceHex, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
};


/**
 * Export wallet
 *
 * @param {Object} opts
 * @param {Boolean} opts.noSign
 */
API.prototype.export = function (opts) {
  $.checkState(this.credentials);

  opts = opts || {};

  let output;

  const c = Credentials.fromObj(this.credentials);

  if (opts.noSign) {
    c.setNoSign();
  }

  output = JSON.stringify(c.toObj());

  return output;
};


/**
 * Import wallet
 *
 * @param {Object} str
 * @param {Object} opts
 * @param {String} opts.password If the source has the private key encrypted, the password
 * will be needed for derive credentials fields.
 */
API.prototype.import = function (str, opts) {
  opts = opts || {};
  try {
    const credentials = Credentials.fromObj(JSON.parse(str));
    this.credentials = credentials;
  } catch (ex) {
    throw Errors.INVALID_BACKUP;
  }
};

API.prototype._import = function (cb) {
  $.checkState(this.credentials);


  // First option, grab wallet info from BWS.
  self.openWallet((err, ret) => {
    // it worked?
    cb(null, ret);
  });
};

/**
 * Import from Mnemonics (language autodetected)
 * Can throw an error if mnemonic is invalid
 *
 * @param {String} BIP39 words
 * @param {Object} opts
 * @param {String} opts.network - default 'livenet'
 * @param {String} opts.passphrase
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.importFromMnemonic = function (words, opts, cb) {
  log.debug('Importing from 12 Words');

  opts = opts || {};
  try {
    this.credentials = Credentials.fromMnemonic(opts.network || 'livenet', words, opts.passphrase, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
  } catch (e) {
    log.info('Mnemonic error:', e);
    return cb(Errors.INVALID_BACKUP);
  }

  this._import(cb);
};

API.prototype.importFromExtendedPrivateKey = function (xPrivKey, cb) {
  log.debug('Importing from Extended Private Key');
  try {
    this.credentials = Credentials.fromExtendedPrivateKey(xPrivKey);
  } catch (e) {
    log.info('xPriv error:', e);
    return cb(Errors.INVALID_BACKUP);
  }

  this._import(cb);
};

/**
 * Import from Extended Public Key
 *
 * @param {String} xPubKey
 * @param {String} source - A name identifying the source of the xPrivKey
 * @param {String} entropySourceHex - A HEX string containing pseudo-random data, that can be deterministically derived from the xPrivKey, and should not be derived from xPubKey.
 * @param {Object} opts
 * @param {Number} opts.account - default 0
 * @param {String} opts.derivationStrategy - default 'BIP44'
 */
API.prototype.importFromExtendedPublicKey = function (xPubKey, source, entropySourceHex, opts, cb) {
  $.checkArgument(arguments.length == 5, 'DEPRECATED: should receive 5 arguments');
  $.checkArgument(_.isUndefined(opts) || _.isObject(opts));
  $.shouldBeFunction(cb);

  opts = opts || {};
  log.debug('Importing from Extended Private Key');
  try {
    this.credentials = Credentials.fromExtendedPublicKey(xPubKey, source, entropySourceHex, opts.account || 0, opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP44);
  } catch (e) {
    log.info('xPriv error:', e);
    return cb(Errors.INVALID_BACKUP);
  }

  this._import(cb);
};

API.prototype.decryptBIP38PrivateKey = function (encryptedPrivateKeyBase58, passphrase, opts, cb) {
  const Bip38 = require('bip38');
  const bip38 = new Bip38();

  let privateKeyWif;
  try {
    privateKeyWif = bip38.decrypt(encryptedPrivateKeyBase58, passphrase);
  } catch (ex) {
    return cb(new Error('Could not decrypt BIP38 private key', ex));
  }

  const privateKey = new Bitcore.PrivateKey(privateKeyWif);
  const address = privateKey.publicKey.toAddress().toString();
  const addrBuff = new Buffer(address, 'ascii');
  const actualChecksum = Bitcore.crypto.Hash.sha256sha256(addrBuff).toString('hex').substring(0, 8);
  const expectedChecksum = Bitcore.encoding.Base58Check.decode(encryptedPrivateKeyBase58).toString('hex').substring(6, 14);

  if (actualChecksum != expectedChecksum) { return cb(new Error('Incorrect passphrase')); }

  return cb(null, privateKeyWif);
};


/**
 * Open a wallet and try to complete the public key ring.
 *
 * @param {Callback} cb - The callback that handles the response. It returns a flag indicating that the wallet is complete.
 * @fires API#walletCompleted
 */
API.prototype.openWallet = function (cb) {
  $.checkState(this.credentials);
  const self = this;
  if (self.credentials.isComplete() && self.credentials.hasWalletInfo()) { return cb(null, true); }

  return cb();
};


/**
 * Return if wallet is complete
 */
API.prototype.isComplete = function () {
  return this.credentials && this.credentials.isComplete();
};

/**
 * Is private key currently encrypted? (ie, locked)
 *
 * @return {Boolean}
 */
API.prototype.isPrivKeyEncrypted = function () {
  return this.credentials && this.credentials.isPrivKeyEncrypted();
};

/**
 * Is private key encryption setup?
 *
 * @return {Boolean}
 */
API.prototype.hasPrivKeyEncrypted = function () {
  return this.credentials && this.credentials.hasPrivKeyEncrypted();
};

/**
 * Is private key external?
 *
 * @return {Boolean}
 */
API.prototype.isPrivKeyExternal = function () {
  return this.credentials && this.credentials.hasExternalSource();
};

/**
 * Get external wallet source name
 *
 * @return {String}
 */
API.prototype.getPrivKeyExternalSourceName = function () {
  return this.credentials ? this.credentials.getExternalSourceName() : null;
};

/**
 * unlocks the private key. `lock` need to be called explicity
 * later to remove the unencrypted private key.
 *
 * @param password
 */
API.prototype.unlock = function (password) {
  try {
    this.credentials.unlock(password);
  } catch (e) {
    throw new Error(`Could not unlock:${e}`);
  }
};

/**
 * Can this credentials sign a transaction?
 * (Only returns fail on a 'proxy' setup for airgapped operation)
 *
 * @return {undefined}
 */
API.prototype.canSign = function () {
  return this.credentials && this.credentials.canSign();
};


/**
 * sets up encryption for the extended private key
 *
 * @param {String} password Password used to encrypt
 * @param {Object} opts optional: SJCL options to encrypt (.iter, .salt, etc).
 * @return {undefined}
 */
API.prototype.setPrivateKeyEncryption = function (password, opts) {
  this.credentials.setPrivateKeyEncryption(password, opts || API.privateKeyEncryptionOpts);
};

/**
 * disables encryption for private key.
 * wallet must be unlocked
 *
 */
API.prototype.disablePrivateKeyEncryption = function (password, opts) {
  return this.credentials.disablePrivateKeyEncryption();
};

/**
 * Locks private key (removes the unencrypted version and keep only the encrypted)
 *
 * @return {undefined}
 */
API.prototype.lock = function () {
  this.credentials.lock();
};


/**
 *
 * Create a wallet.
 * @param {String} walletName
 * @param {Number} m
 * @param {Number} n
 * @param {object} opts (optional: advanced options)
 * @param {string} opts.network - 'livenet' or 'testnet'
 * @param {String} opts.walletPrivKey - set a walletPrivKey (instead of random)
 * @param {String} opts.id - set a id for wallet (instead of server given)
 * @param {String} opts.withMnemonics - generate credentials
 * @param cb
 * @return {undefined}
 */
API.prototype.createWallet = function (walletName, m, n, opts, cb) {
  const self = this;
  if (opts) $.shouldBeObject(opts);
  opts = opts || {};

  const network = opts.network || 'livenet';
  if (!_.includes(['testnet', 'livenet'], network)) { return cb(new Error('Invalid network')); }

  if (!self.credentials) {
    log.info('Generating new keys');
        // generates xPrivKey and derives xPubKey for the base path m/44'/0'/account'
    self.seedFromRandom({
      network,
      account: opts.account,
    });
  } else {
    log.info('Using existing keys');
        // self.credentials.account = account;
  }

  walletDefinedByKeys.createWalletByDevices(self.credentials.xPubKey, opts.account || 0, m, opts.cosigners || [], walletName, (wallet) => {
    self.credentials.walletId = wallet;
    console.log('wallet created', self.credentials);
    if (network != self.credentials.network) { return cb(new Error('Existing keys were created for a different network')); }

    self.credentials.addWalletInfo(walletName, m, n);
    cb(null);
  });
};


/**
 * Recreates a wallet, given credentials (with wallet id)
 *
 * @returns {Callback} cb - Returns the wallet
 */
API.prototype.recreateWallet = function (cb) {
  $.checkState(this.credentials);
  $.checkState(this.credentials.isComplete());
  // $.checkState(this.credentials.hasWalletInfo());


  self.openWallet(err => cb(err));

  cb();
};


/**
 * Create a new address
 *
 * @param {Callback} cb
 * @returns {Callback} cb - Return error or the address
 */
API.prototype.createAddress = function (is_change, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.shouldBeFunction(cb);
  $.shouldBeNumber(is_change);

  const coin = (this.credentials.network == 'livenet' ? '0' : '1');
  const self = this;
  breadcrumbs.add(`createAddress wallet=${this.credentials.walletId}, is_change=${is_change}`);
  walletDefinedByKeys.issueOrSelectNextAddress(this.credentials.walletId, is_change, (addressInfo) => {
    const path = `m/44'/${coin}'/${self.credentials.account}'/0/${addressInfo.address_index}`;
    cb(null, { address: addressInfo.address, path, createdOn: addressInfo.creation_ts });
  });
};

/*
API.prototype.sendPayment = function(asset, to_address, amount, arrSigningDeviceAddresses, recipient_device_address, cb) {
	this.sendMultiPayment({
		asset: asset,
		to_address: to_address,
		amount: amount,
		arrSigningDeviceAddresses: arrSigningDeviceAddresses,
		recipient_device_address: recipient_device_address
	}, cb);
}*/

API.prototype.sendMultiPayment = function (opts, cb) {
  const self = this;
  const coin = (this.credentials.network == 'livenet' ? '0' : '1');
  const Wallet = require('byteballcore/wallet.js');

  opts.signWithLocalPrivateKey = function (wallet_id, account, is_change, address_index, text_to_sign, handleSig) {
    const path = `m/44'/${coin}'/${account}'/${is_change}/${address_index}`;
    const xPrivKey = new Bitcore.HDPrivateKey.fromString(self.credentials.xPrivKey);
    const privateKey = xPrivKey.derive(path).privateKey;
        // var privKeyBuf = privateKey.toBuffer();
    const privKeyBuf = privateKey.bn.toBuffer({ size: 32 }); // https://github.com/bitpay/bitcore-lib/issues/47
    handleSig(ecdsaSig.sign(text_to_sign, privKeyBuf));
  };

  if (opts.shared_address) {
    opts.paying_addresses = [opts.shared_address];
    opts.change_address = opts.shared_address;
    if (opts.asset && opts.asset !== 'base') { opts.fee_paying_wallet = self.credentials.walletId; }
    Wallet.sendMultiPayment(opts, cb);
  }	else {
		// create a new change address or select first unused one
    walletDefinedByKeys.issueOrSelectNextChangeAddress(self.credentials.walletId, (objAddr) => {
      opts.change_address = objAddr.address;
      opts.wallet = self.credentials.walletId;
      Wallet.sendMultiPayment(opts, cb);
    });
  }
};

API.prototype.getAddresses = function (opts, cb) {
  const coin = (this.credentials.network == 'livenet' ? '0' : '1');
  const self = this;
  walletDefinedByKeys.readAddresses(this.credentials.walletId, opts, (arrAddressInfos) => {
    cb(null, arrAddressInfos.map(addressInfo => ({
      address: addressInfo.address,
      createdOn: addressInfo.creation_ts,
      path: `m/44'/${coin}'/${self.credentials.account}'/${addressInfo.is_change}/${addressInfo.address_index}`,
    })));
  });
};


/**
 * Update wallet balance
 *
 * @param {Callback} cb
 */
API.prototype.getBalance = function (shared_address, cb) {
  const Wallet = require('byteballcore/wallet.js');
  $.checkState(this.credentials && this.credentials.isComplete());
  const walletId = this.credentials.walletId;
  Wallet.readBalance(shared_address || walletId, (assocBalances) => {
    if (!assocBalances[constants.DAGCOIN_ASSET]) { assocBalances[constants.DAGCOIN_ASSET] = { stable: 0, pending: 0 }; }
    Wallet.readSharedBalance(walletId, (assocSharedBalances) => {
      for (const asset in assocSharedBalances) {
        if (!assocBalances[asset]) { assocBalances[asset] = { stable: 0, pending: 0 }; }
      }
      cb(null, assocBalances, assocSharedBalances);
    });
  });
};

API.prototype.getListOfBalancesOnAddresses = function (cb) {
  const Wallet = require('byteballcore/wallet.js');
  $.checkState(this.credentials && this.credentials.isComplete());
  const walletId = this.credentials.walletId;
  Wallet.readBalancesOnAddresses(walletId, (assocBalances) => {
    cb(assocBalances);
  });
};

API.prototype.getTxHistory = function (asset, shared_address, cb) {
  const Wallet = require('byteballcore/wallet.js');
  $.checkState(this.credentials && this.credentials.isComplete());
  const opts = { asset };
  if (shared_address) { opts.address = shared_address; } else		{ opts.wallet = this.credentials.walletId; }
  Wallet.readTransactionHistory(opts, (arrTransactions) => {
    cb(arrTransactions);
  });
};

API.prototype.initDeviceProperties = function (xPrivKey, device_address, hub, deviceName) {
  console.log('initDeviceProperties');
  const device = require('byteballcore/device.js');
  const lightWallet = require('byteballcore/light_wallet.js');
  if (device_address) { device.setDeviceAddress(device_address); }
  device.setDeviceName(deviceName);
  device.setDeviceHub(hub);
  lightWallet.setLightVendorHost(hub);
    // device.setDevicePrivateKey(Bitcore.HDPrivateKey.fromString(xPrivKey).derive("m/1'").privateKey.toBuffer());

    // since this is executed at app launch, give in to allow other startup tasks to complete
    // setTimeout(function(){
  try {
            /*
            console.log("device priv key will come next");
            console.log("xPrivKey=", xPrivKey);
            console.log("bitcore=", Bitcore);
            console.log("HDPrivateKey=", Bitcore.HDPrivateKey);
            console.log("xprivkey=", Bitcore.HDPrivateKey.fromString(xPrivKey));
            console.log("derived=", Bitcore.HDPrivateKey.fromString(xPrivKey).derive("m/1'"));
            console.log("privkey=", Bitcore.HDPrivateKey.fromString(xPrivKey).derive("m/1'").privateKey);
            console.log("bn=", Bitcore.HDPrivateKey.fromString(xPrivKey).derive("m/1'").privateKey.bn);
            console.log("buffer=", Bitcore.HDPrivateKey.fromString(xPrivKey).derive("m/1'").privateKey.bn.toBuffer({size:32}));
            console.log("device priv key="+Bitcore.HDPrivateKey.fromString(xPrivKey).derive("m/1'").privateKey.bn.toBuffer({size:32}).toString("base64"));
            */
    device.setDevicePrivateKey(Bitcore.HDPrivateKey.fromString(xPrivKey).derive("m/1'").privateKey.bn.toBuffer({ size: 32 }));
  } catch (e) {
    console.log(`error in initDeviceProperties: ${e}`);
    throw e;
  }
    // }, 1);
};


module.exports = API;
