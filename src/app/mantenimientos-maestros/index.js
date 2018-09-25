import angular from 'angular';
import ngSanitize from "angular-sanitize";
import modal from 'ui-bootstrap4/src/modal';
import alert from "ui-bootstrap4/src/alert";
import 'angular-bootstrap-toggle/dist/angular-bootstrap-toggle.js';

import geTablaModule from '../common/ge-tabla';
import botonAsyncModule from '../common/boton-async';
import modalAsyncModule from '../common/modal-async';
import customValidatorsModule from '../common/custom-validators';

import ModulosService from './modulos/modulos.service';
import ModulosController from './modulos/modulos.controller';
import ModalEdicionModulosController from './modulos/modal-edicion-modulos.controller';

import './mantenimientos-maestros.scss';


export default angular.module('mantimientos-maestros', [
    ngSanitize,
    modal,
    alert,
    'ui.toggle',

    geTablaModule.name,
    botonAsyncModule.name,
    modalAsyncModule.name,
    customValidatorsModule.name
])
    .constant('ErroresValidacionMaestros', {
        FALTA_REQUERIDO: -1,
        YA_EXISTE_NOMBRE: -2,
        YA_EXISTE_ORDEN: -3,
        FECHA_FINAL_MENOR_QUE_FECHA_INICIAL: -4
    })
    .service('ModulosService', ModulosService)
    .controller('ModulosController', ModulosController)
    .controller('ModalEdicionModulosController', ModalEdicionModulosController);