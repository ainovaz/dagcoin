

angular.module('copayApp.controllers').controller('copayersController',
  function ($scope, $rootScope, $timeout, $log, $modal, profileService, go, notification, isCordova, gettext, gettextCatalog, animationService) {
    const self = this;

    const delete_msg = gettextCatalog.getString('Are you sure you want to delete this wallet?');
    const accept_msg = gettextCatalog.getString('Accept');
    const cancel_msg = gettextCatalog.getString('Cancel');
    const confirm_msg = gettextCatalog.getString('Confirm');

    self.init = function () {
      const fc = profileService.focusedClient;
      if (fc.isComplete()) {
        $log.debug('Wallet Complete...redirecting');
        go.walletHome();
        return;
      }
      self.loading = false;
      self.isCordova = isCordova;
    };

    const _modalDeleteWallet = function () {
      const ModalInstanceCtrl = function ($scope, $modalInstance, gettext) {
        $scope.title = delete_msg;
        $scope.yes_icon = 'fi-trash';
        $scope.yes_button_class = 'warning';
        $scope.cancel_button_class = 'light-gray outline';
        $scope.loading = false;

        $scope.ok = function () {
          $scope.loading = true;
          $modalInstance.close(accept_msg);
        };
        $scope.cancel = function () {
          $modalInstance.dismiss(cancel_msg);
        };
      };

      const modalInstance = $modal.open({
        templateUrl: 'views/modals/confirmation.html',
        windowClass: animationService.modalAnimated.slideUp,
        controller: ModalInstanceCtrl,
      });

      modalInstance.result.finally(() => {
        const m = angular.element(document.getElementsByClassName('reveal-modal'));
        m.addClass(animationService.modalAnimated.slideOutDown);
      });

      modalInstance.result.then((ok) => {
        if (ok) {
          _deleteWallet();
        }
      });
    };

    var _deleteWallet = function () {
      const fc = profileService.focusedClient;
      $timeout(() => {
        const fc = profileService.focusedClient;
        const walletName = fc.credentials.walletName;

        profileService.deleteWallet({}, function (err) {
          if (err) {
            this.error = err.message || err;
            console.log(err);
            $timeout(() => {
              $scope.$digest();
            });
          } else {
            go.walletHome();
            $timeout(() => {
              notification.success(gettextCatalog.getString('Success'), gettextCatalog.getString('The wallet "{{walletName}}" was deleted', { walletName }));
            });
          }
        });
      }, 100);
    };

    self.deleteWallet = function () {
      const fc = profileService.focusedClient;
      if (isCordova) {
        navigator.notification.confirm(
          delete_msg,
          (buttonIndex) => {
            if (buttonIndex == 1) {
              _deleteWallet();
            }
          },
          confirm_msg, [accept_msg, cancel_msg]);
      } else {
        _modalDeleteWallet();
      }
    };
  });
