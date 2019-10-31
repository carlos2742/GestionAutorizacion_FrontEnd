import angular from 'angular';
import concat from 'lodash/concat';
import forEach from 'lodash/forEach';
import isNil from 'lodash/isNil';


/**
 * Contiene la directiva <modal-async>, que al añadirla a un div de un modal deshabilita todos los elementos contenidos
 * en ese div (inputs, botones, etc) mientras se está haciendo un request al API.
 * @typedef {Object} Componentes.modal-async
 * @example
 * <div class="modal-body" modal-async>...</div>
 */
export default angular.module('modal-async', [])
    .directive('modalAsync', ($rootScope) => {
        return {
            restrict: 'A',
            link: (scope, element, attrs) => {
                let modalDeshabilitado = false;
                let hijosEditables = [];

                const fnHabilitarHijos = () => {
                    forEach(hijosEditables, (hijo) => {
                        if (hijo && hijo.prop){ hijo.prop('disabled', false) }
                    });
                    hijosEditables = [];
                };

                const listenerRequest = $rootScope.$on('GestionAutorizacionAPI:request', (event, method) => {
                    if (!isNil(method) && method !== 'GET') {
                        modalDeshabilitado = true;
                        hijosEditables = concat([], element.find('input'), element.find('select'), element.find('textarea'), element.find('button'));
                        forEach(hijosEditables, (hijo) => {
                            if (hijo && hijo.prop){ hijo.prop('disabled', true) }
                        });
                    }
                });
                const listenerResponse = $rootScope.$on('GestionAutorizacionAPI:response', (event, method) => {
                    if (method !== 'GET') {
                        modalDeshabilitado = false;
                        fnHabilitarHijos();
                    }
                });
                const listenerResponseError = $rootScope.$on('GestionAutorizacionAPI:responseError', () => {
                    modalDeshabilitado = false;
                    fnHabilitarHijos();
                });

                const listenerModal = scope.$on('modal.closing', (event) => {
                    if (modalDeshabilitado) {
                        event.preventDefault();
                    }
                });

                scope.$on('$destroy', () => {
                    listenerRequest();
                    listenerResponse();
                    listenerResponseError();
                    listenerModal();
                });

            }
        };
    });