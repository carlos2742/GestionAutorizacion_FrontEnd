import angular from 'angular';
import modal from 'ui-bootstrap4/src/modal';
import tooltip from 'ui-bootstrap4/src/tooltip';

import customCompile from '../custom-compile';
import botonAsync from '../boton-async';
import modalAsync from '../modal-async';
import exportarExcel from '../exportar-excel';

import './ge-tabla.controller';
import GETablaController from "./ge-tabla.controller";
import ModalEliminarEntidadController from "./modal-eliminar-entidad.controller";

import html from './ge-tabla.html';
import './ge-tabla.scss';

/**
 * Contiene el componente <ge-tabla> que se usa para mostrar todas las tablas de la aplicación.
 * @typedef {Object} Componentes.ge-tabla
 * @property {Object[]} datos               -  Arreglo con los datos que se desean mostrar en la tabla
 *
 * @property {Object} presentacion                                  -  Define cómo se deben mostrar los datos.
 * @property {string} presentacion.entidad                          -  Cómo se llama la entidad a la que pertenecen los datos (ej: Competencia).
 *                                                                      Usado para generar el texto del modal de confirmación antes de eliminar.
 * @property {string} presentacion.atributoPrincipal                -  Campo de la entidad que mejor la describe. Generalmente es 'nombre'.
 *                                                                       Usado para generar el texto del modal de confirmación antes de eliminar.
 * @property {{string, string}[]} presentacion.ordenInicial         -  Si los datos están inicialmente ordenados por algún
 *                                                                      campo, se debe pasar con el formato: ['nombre', 'asc'], por ejemplo,
 *                                                                      para poder visualizarlo correctamente.
 * @property {Object[]} presentacion.columnas                       - Arreglo con cada una de las columnas de la tabla
 * @property {string} presentacion.columnas[0].nombre               -  Atributo de la entidad que se va a mostrar en esa columna.
 * @property {string} presentacion.columnas[0].display              -  Encabezado de la columna.
 * @property {boolean|string} presentacion.columnas[0].ordenable    - Se debe pasar en true si la columna es ordenable por el valor
 *                                                                    que se pasó en 'nombre'. Si se pasa un string, se ordena por
 *                                                                    ese campo. Ej: columnas: {nombre: 'fecha.display', ordenable: 'fecha.valor'}
 * @property {string} presentacion.columnas[0].ancho                - Ancho que debe tener la columna. Ejemplo: '150px'.
 * @property {boolean} presentacion.columnas[0].html                - Si este valor se pasa en true, se compila el valor contenido en el atributo
 *                                                                      'nombre' y se inserta como html en cada celda. Por defecto el contenido se muestra
 *                                                                      como un string.
 *
 * @property {Object} camposExcel            -  Se debe pasar este atributo si se desea que se muestre el componente <btn-exportar-excel> para
 *                                              exportar los datos visibles en la tabla.
 * @property {string[]} camposExcel.titulos  -  Títulos de las columnas en el Excel.
 * @property {string[]} camposExcel.campos   -  Campos de la entidad que se desea exportar.
 * @property {Object} filaSeleccionada       -  Se debe usar si se quiere seleccionar programáticamente una fila de la tabla.
 * @property {function} fnEdicion            -  Función que se va a llamar si el usuario hace click en el botón Editar de una fila. Para que este
 *                                              botón sea visible, la entidad de la fila debe tener el atributo editable=true.
 * @property {function} fnEliminacion        -  Función que se va a llamar si el usuario hace click en el botón Eliminar de una fila. Para que este
 *                                              botón sea visible, la entidad de la fila debe tener el atributo eliminable=true.
 * @property {function} fnAccion             -  Este función permite añadir funcionalidad extra a una fila de la tabla. Un ejemplo de su uso:
 *                                              {@link NivelesCompetenciasController}
 * @property {function} fnSeleccion          -  Esta función se ejecuta cada vez que el usuario selecciona una fila en la tabla. Útil si es
 *                                              necesario actualizar algo en el controlador padre cada vez que esto pasa.
 * @property {function} fnCambioOrden        -  Esta función se ejecuta cada vez que el usuario cambia el ordenamiento de la tabla.  Útil si es
 *                                              necesario actualizar algo en el controlador padre cada vez que esto pasa.
 *
 * @example
 * <ge-tabla datos="vm.datos" presentacion="vm.presentacion"
 *          fila-seleccionada="vm.entidadSeleccionada"
 *          fn-edicion="vm.editar(entidad)"
 *          fn-eliminacion="vm.eliminar(entidad)"
 *          fn-accion="vm.cambiarEstado(entidad)"
 *          fn-seleccion="vm.seleccionar(entidad)"
 *          fn-cambio-orden="vm.ordenCambiado(orden)"
 *          campos-excel=":: vm.columnasExcel">
 *  </ge-tabla>
 */
export default angular.module('ge-tabla', [
    modal,
    tooltip,
    customCompile.name,
    botonAsync.name,
    modalAsync.name,
    exportarExcel.name
])
    .component('geTabla', {
        bindings: {
            datos: '<',
            presentacion: '<',
            camposExcel: '<',
            filaSeleccionada: '<',
            fnEdicion: '&',
            fnEliminacion: '&',
            fnAccion: '&',
            fnSeleccion: '&',
            fnCambioOrden: '&'
        },
        template: html,
        controller: ['$attrs', '$uibModal', 'AppConfig', GETablaController]
    })
    .controller('ModalEliminarEntidadController', ModalEliminarEntidadController);