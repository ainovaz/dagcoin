

angular.module('copayApp.controllers').controller('editCorrespondentDeviceController',
  function ($scope, $rootScope, $timeout, configService, profileService, isCordova, go, correspondentListService, $modal, animationService) {
    const self = this;

    const fc = profileService.focusedClient;
    $scope.backgroundColor = fc.backgroundColor;
    const correspondent = correspondentListService.currentCorrespondent;
    $scope.correspondent = correspondent;
    $scope.name = correspondent.name;
    $scope.hub = correspondent.hub;

    $scope.save = function () {
      $scope.error = null;
      correspondent.name = $scope.name;
      correspondent.hub = $scope.hub;
      const device = require('byteballcore/device.js');
      device.updateCorrespondentProps(correspondent, () => {
        go.path('correspondentDevices.correspondentDevice');
      });
    };

    $scope.purge_chat = function () {
      const ModalInstanceCtrl = function ($scope, $modalInstance, $sce, gettext) {
        $scope.title = $sce.trustAsHtml(`Delete the whole chat history with ${correspondent.name}?`);

        $scope.ok = function () {
          $modalInstance.close(true);
          go.path('correspondentDevices.correspondentDevice');
        };
        $scope.cancel = function () {
          $modalInstance.dismiss('cancel');
          go.path('correspondentDevices.editCorrespondentDevice');
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
          	const chatStorage = require('byteballcore/chat_storage.js');
          chatStorage.purge(correspondent.device_address);
          correspondentListService.messageEventsByCorrespondent[correspondent.device_address] = [];
        }
      });
    };

    function setError(error) {
      $scope.error = error;
    }
  });
