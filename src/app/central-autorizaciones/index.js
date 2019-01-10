import angular from 'angular';
import ngSanitize from 'angular-sanitize';
import modal from 'ui-bootstrap4/src/modal';
import alert from 'ui-bootstrap4/src/alert';
import collapse from 'ui-bootstrap4/src/collapse';
import timepicker from 'ui-bootstrap4/src/timepicker';
import uiSelect from 'ui-select';
import readMore from 'angular-read-more';

import 'angular-file-upload';

import geTablaModule from '../common/ge-tabla/index';
import botonAsyncModule from '../common/boton-async/index';
import modalAsyncModule from '../common/modal-async/index';
import customValidatorsModule from '../common/custom-validators/index';
import selectorFechaModule from '../common/selector-fecha/index';
import conversacionModule from '../common/conversacion';
import mantenimientosMaestrosModule from '../mantenimientos-maestros/index';

import PeticionesService from './peticiones/peticiones.service';
import PeticionesController from './peticiones/peticiones.controller';
import DetallesPeticionController from './detalles-peticion/detalles-peticion.controller';
import AdjuntosService from './adjuntos/adjuntos.service';
import ModalAdjuntosController from './adjuntos/modal-adjuntos-controller';
import MensajesService from './mensajes/mensajes.service';
import ModalMensajesController from './mensajes/modal-mensajes.controller';


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
    conversacionModule.name,

    mantenimientosMaestrosModule.name
])
    .service('PeticionesService', PeticionesService)
    .controller('PeticionesController', PeticionesController)
    .controller('DetallesPeticionController', DetallesPeticionController)
    .service('AdjuntosService', AdjuntosService)
    .controller('ModalAdjuntosController', ModalAdjuntosController)
    .service('MensajesService', MensajesService)
    .controller('ModalMensajesController', ModalMensajesController)

    .config(($provide) => {
        // Esto es necesario para que lo siguiente funcione:
        // 1 - Añadir un adjunto,   2 - Seleccionar otro sin cerrar el modal,     3 - Añadir el mismo adjunto sin cerrar el modal
        $provide.decorator('FileSelect', ['$delegate', (FileSelect) => {
            FileSelect.prototype.isEmptyAfterSelection = () => {
                return true;
            };
            return FileSelect;
        }]);
    });