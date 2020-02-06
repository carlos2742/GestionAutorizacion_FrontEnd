import angular from 'angular';
import modal from 'ui-bootstrap4/src/modal';
import botonAsync from '../boton-async';
import modalAsync from '../modal-async';

import html from './exportar-excel.html';
import './exportar-excel.scss';
import ExportarExcelController from './exportar-excel.controller';
import {ModalExcelController} from './exportar-excel.controller';


/**
 * Contiene el componente <btn-exportar-excel>, que contiene un botón en el que al hacer click se muestra un modal donde el
 * usuario debe poner el nombre del documento Excel que desea generar, y una vez que le da al botón Generar y selecciona
 * donde desea guardar el documento este se genera. Se puede usar de dos maneras: o se pasan directamente los datos que
 * se desean exportar, o se pasa una función asíncrona (que devuelva una Promesa) que será llamada antes de generar el
 * Excel.
 * @typedef {Object} Componentes.btn-exportar-excel
 * @property {Object[]} datos                -  Arreglo de datos que se desea exportar
 * @property {Object} propiedades
 * @property {string[]} propiedades.titulos  -  Títulos de las columnas en el Excel.
 * @property {string[]} propiedades.campos   -  Campos de la entidad que se desea exportar.
 * @property {function} fnObtencionDatos     -  Se debe pasar esta función para obtener los datos que se desean exportar
 *                                              de manera asíncrona. Debe devolver una promesa.
 *
 * @example
 * <btn-exportar-excel datos="$ctrl.datos" propiedades="$ctrl.camposExcel"></btn-exportar-excel>
 */
export default angular.module('exportar-excel', [
    modal,
    botonAsync.name,
    modalAsync.name
])
    .component('btnExportarExcel', {
        bindings: {
            datos: '=',
            propiedades: '<',
            fnObtencionDatos: '&',
            datosObtenidos: '=?',
            activarRango: '='
        },
        template: html,
        controller: ['$attrs', '$uibModal', ExportarExcelController]
    })
    .controller('ExportarExcelController', ExportarExcelController)
    .controller('ModalExcelController', ModalExcelController);