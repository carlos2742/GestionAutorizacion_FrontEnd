import angular from 'angular';
import ngSanitize from 'angular-sanitize';
import modal from 'ui-bootstrap4/src/modal';
import alert from 'ui-bootstrap4/src/alert';
import pagination from 'ui-bootstrap4/src/pagination';
import 'angular-bootstrap-toggle/dist/angular-bootstrap-toggle.js';
import uiSelect from 'ui-select';

import geTablaModule from '../common/ge-tabla';
import botonAsyncModule from '../common/boton-async';
import modalAsyncModule from '../common/modal-async';
import customValidatorsModule from '../common/custom-validators';
import selectorFechaModule from '../common/selector-fecha';

import AplicacionesService from './aplicaciones/aplicaciones.service';
import AplicacionesController from './aplicaciones/aplicaciones.controller';
import ModalEdicionAplicacionesController from './aplicaciones/modal-edicion-aplicaciones.controller';

import RolesService from './roles/roles.service';
import RolesController from './roles/roles.controller';
import ModalEdicionRolesController from './roles/modal-edicion-roles.controller';

import ProcesosService from './procesos/procesos.service';
import ProcesosController from './procesos/procesos.controller';
import ModalEdicionProcesosController from './procesos/modal-edicion-procesos.controller';

import ActividadesService from './actividades/actividades.service';
import ActividadesController from './actividades/actividades.controller';
import ModalEdicionActividadesController from './actividades/modal-edicion-actividades.controller';

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
    .service('AplicacionesService', AplicacionesService)
    .controller('AplicacionesController', AplicacionesController)
    .controller('ModalEdicionAplicacionesController', ModalEdicionAplicacionesController)

    .service('RolesService', RolesService)
    .controller('RolesController', RolesController)
    .controller('ModalEdicionRolesController', ModalEdicionRolesController)

    .service('ProcesosService', ProcesosService)
    .controller('ProcesosController', ProcesosController)
    .controller('ModalEdicionProcesosController', ModalEdicionProcesosController)

    .service('EtiquetasService', EtiquetasService)
    .controller('EtiquetasController', EtiquetasController)
    .controller('ModalEdicionEtiquetasController', ModalEdicionEtiquetasController)

    .service('ActividadesService', ActividadesService)
    .controller('ActividadesController', ActividadesController)
    .controller('ModalEdicionActividadesController', ModalEdicionActividadesController)

    .config(($provide, uiSelectConfig) => {
        uiSelectConfig.theme = 'selectize';
    });