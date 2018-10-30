import angular from 'angular';
import ngSanitize from "angular-sanitize";
import modal from 'ui-bootstrap4/src/modal';
import alert from "ui-bootstrap4/src/alert";
import pagination from "ui-bootstrap4/src/pagination";
import 'angular-bootstrap-toggle/dist/angular-bootstrap-toggle.js';
import uiSelect from "ui-select";

import geTablaModule from '../common/ge-tabla';
import botonAsyncModule from '../common/boton-async';
import modalAsyncModule from '../common/modal-async';
import customValidatorsModule from '../common/custom-validators';
import selectorFechaModule from "../common/selector-fecha";

import ModulosService from './modulos/modulos.service';
import ModulosController from './modulos/modulos.controller';
import ModalEdicionModulosController from './modulos/modal-edicion-modulos.controller';

import RolesService from './roles/roles.service';
import RolesController from './roles/roles.controller';
import ModalEdicionRolesController from './roles/modal-edicion-roles.controller';

import FlujosService from './flujos/flujos.service';
import FlujosController from './flujos/flujos.controller';
import ModalEdicionFlujosController from './flujos/modal-edicion-flujos.controller';

import AutorizacionesService from './autorizaciones/autorizaciones.service';
import AutorizacionesController from './autorizaciones/autorizaciones.controller';
import ModalEdicionAutorizacionesController from './autorizaciones/modal-edicion-autorizaciones.controller';

import EtiquetasService from './etiquetas/etiquetas.service';
import EtiquetasController from './etiquetas/etiquetas.controller';
import ModalEdicionEtiquetasController from './etiquetas/modal-edicion-etiquetas.controller';

import './mantenimientos-maestros.scss';


export default angular.module('mantimientos-maestros', [
    ngSanitize,
    modal,
    alert,
    pagination,
    'ui.toggle',
    uiSelect,

    geTablaModule.name,
    botonAsyncModule.name,
    modalAsyncModule.name,
    customValidatorsModule.name,
    selectorFechaModule.name
])
    .constant('ErroresValidacionMaestros', {
        FALTA_REQUERIDO: -1,
        YA_EXISTE_NOMBRE: -2,
        YA_EXISTE_ORDEN: -3,
        FECHA_FINAL_MENOR_QUE_FECHA_INICIAL: -4,
        ELEMENTO_DUPLICADO: -5
    })
    .service('ModulosService', ModulosService)
    .controller('ModulosController', ModulosController)
    .controller('ModalEdicionModulosController', ModalEdicionModulosController)

    .service('RolesService', RolesService)
    .controller('RolesController', RolesController)
    .controller('ModalEdicionRolesController', ModalEdicionRolesController)

    .service('FlujosService', FlujosService)
    .controller('FlujosController', FlujosController)
    .controller('ModalEdicionFlujosController', ModalEdicionFlujosController)

    .service('EtiquetasService', EtiquetasService)
    .controller('EtiquetasController', EtiquetasController)
    .controller('ModalEdicionEtiquetasController', ModalEdicionEtiquetasController)

    .service('AutorizacionesService', AutorizacionesService)
    .controller('AutorizacionesController', AutorizacionesController)
    .controller('ModalEdicionAutorizacionesController', ModalEdicionAutorizacionesController)

    .config(($provide, uiSelectConfig) => {
        uiSelectConfig.theme = 'selectize';
    });