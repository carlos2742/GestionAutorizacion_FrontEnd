import angular from 'angular';
import ngSanitize from "angular-sanitize";
import modal from 'ui-bootstrap4/src/modal';
import alert from "ui-bootstrap4/src/alert";
import collapse from 'ui-bootstrap4/src/collapse';
import timepicker from 'ui-bootstrap4/src/timepicker';
import uiSelect from "ui-select";
import readMore from "angular-read-more";

import "angular-file-upload";

import geTablaModule from '../common/ge-tabla/index';
import botonAsyncModule from '../common/boton-async/index';
import modalAsyncModule from '../common/modal-async/index';
import customValidatorsModule from '../common/custom-validators/index';
import selectorFechaModule from "../common/selector-fecha/index";
import mantenimientosMaestrosModule from '../mantenimientos-maestros/index';

import PeticionesService from "./peticiones/peticiones.service";
import PeticionesController from "./peticiones/peticiones.controller";

export default angular.module('central-autorizacion', [
    ngSanitize,
    modal,
    alert,
    collapse,
    timepicker,
    uiSelect,
    readMore,
    'angularFileUpload',

    geTablaModule.name,
    botonAsyncModule.name,
    modalAsyncModule.name,
    customValidatorsModule.name,
    selectorFechaModule.name,

    mantenimientosMaestrosModule.name
])
    .service('PeticionesService', PeticionesService)
    .controller('PeticionesController', PeticionesController);