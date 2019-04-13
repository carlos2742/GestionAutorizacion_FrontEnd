import orderBy from 'lodash/orderBy';
import isNil from 'lodash/isNil';
import find from 'lodash/find';
import get from 'lodash/get';

import modalEliminarEntidad from './modal-eliminar-entidad.html';

/* @ngInject */
/**
 * Esta clase contiene el controlador de Angular del componente que se usa para mostrar todas las tablas en la aplicación.
 */
export default class GETablaController {

    /**
     * @param $attrs
     * @param $uibModal
     * @param AppConfig
     *
     **/
    constructor($attrs, $uibModal, AppConfig) {
        /** @private */
        this.$attrs = $attrs;
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.AppConfig = AppConfig;
        /** @type {Object} */
        this.filaSeleccionada = { codigo: null };

        /** @type {boolean} */
        this.mostrarLoader = true;
        /** @private */
        this.ordenInicial = true;
    };

    /**
     * Este método se ejecuta una vez justo antes de mostrar el componente en la interfaz.
     */
    $onInit() {
        this.ordenActivo = this.presentacion.ordenInicial;
        this.accionSeleccionDefinida = !!this.$attrs.fnSeleccion;
        this.camposExcelDefinidos = !!this.$attrs.camposExcel;
    }

    /**
     * IMPORTANTE:
     * Para que el componente se entere de los cambios del atributo 'datos' (inserciones & modificaciones en el arreglo),
     * es necesario hacer una copia del arreglo en el controlador de la vista donde se usa este componente.
     * Para más detalles, ver este issue: {@link https://github.com/angular/angular.js/issues/14378}
     * @example
     * // Si el html es: <ge-tabla datos="vm.datos" ... ></ge-tabla>
     * // Para actualizar los datos, se debe poner en el controlador:
     * this.datos = clone(this.datos);      // Ejemplo usando el método clone de Lodash
     *
     * @param {Object} cambios
     */
    $onChanges(cambios) {
        if (cambios.datos) {
            if ((cambios.datos.isFirstChange() || isNil(cambios.datos.previousValue)) && !isNil(cambios.datos.currentValue)) {
                this.mostrarLoader = false;
            } else if (!isNil(cambios.datos.previousValue) && isNil(cambios.datos.currentValue)) {
                this.mostrarLoader = true;
            }

            /** @type {boolean} */
            this.editable = find(this.datos, item => { return item.editable });
            /** @type {boolean} */
            this.eliminable = find(this.datos, item => { return item.eliminable });
            if (this.ordenActivo) {
                if (!this.ordenInicial && !get(this.datos, 'yaOrdenados')) {
                    this.ordenar({nombre: this.ordenActivo[0]}, this.ordenActivo[1]);
                } else {
                    this.ordenInicial = false;
                }
            }
        }
    }

    /**
     * Devuelve la cantidad de columnas que contiene la tabla.
     */
    get totalColumnas() {
        let total = this.presentacion.columnas.length;
        if (this.editable) { total++ }
        if (this.eliminable) { total++ }
        return total;
    }

    /**
     * Ordena los datos de la tabla según los valores contenidos en la columna que se pasa como parámetros. Si el ordenamiento
     * lo solicitó el usuario interactuando con la interfaz, en vez de un ordenamiento producido por una actualización
     * de los datos, se ejecuta la función que notifica al controlador padre de que se produjo un ordenamiento.
     *
     * @param {Object} columna                  -  Columna de las entidades por el que hay que ordenarlas
     * @param {string} modo                     -  Puede ser 'asc' o 'desc'
     * @param {boolean} solicitadoPorUsuario    -  Se pasa en verdadero si el ordenamiento se produjo porque el usuario
     *                                              hizo click para ordenar una columna.
     */
    ordenar(columna, modo, solicitadoPorUsuario) {
        if (!isNil(columna)) {
            let campo = columna.nombre;
            if (typeof columna.ordenable === 'string' ) {
                campo = columna.ordenable;
            }

            this.datos = orderBy(this.datos,
                [entidad => {
                    const valor = get(entidad, campo);
                    return typeof valor === 'string' ? valor.toLowerCase() : valor }],
                [modo]);
            this.ordenActivo = [campo, modo];

            if (solicitadoPorUsuario) {
                this.fnCambioOrden({orden: this.ordenActivo});
            }
        }
    }

    /**
     * Se muestra un modal preguntando al usuario si está seguro de que desea eliminar una entidad. En caso afirmativo,
     * se ejecuta en el controlador padre la función que elimina dicha entidad.
     * @param {Object} elemento          -  Entidad que se desea eliminar.
     */
    confirmarEliminacion(elemento) {
        const contenedor = angular.element(document.getElementById(`modalEliminar${this.presentacion.entidad}`));

        this.$uibModal.open({
            template: modalEliminarEntidad,
            appendTo: contenedor,
            controller: 'ModalEliminarEntidadController',
            controllerAs: '$modal',
            resolve: {
                nombre: () => { return `"${get(elemento, this.presentacion.atributoPrincipal)}"` },
                elemento: () => { return elemento },
                entidad: () => { return this.presentacion.entidad },
                fnEliminacion: () => { return this.fnEliminacion }
            }
        }).result.catch(() => {
            // Es necesario añadir este catch vacío para que la biblioteca 'ui-bootstrap4' no muestre la siguiente excepción en consola:
            // Possibly unhandled rejection: backdrop click
            // Cuando se hace click fuera del modal para cerrarlo
        });
    }

    /**
     * Notifica al controlador padre de la fila que fue seleccionada en la tabla.
     *
     * @param {Object} elemento      -  Entidad seleccionada en la tabla.
     */
    seleccionarFila(elemento) {
        this.filaSeleccionada = elemento;
        this.fnSeleccion({entidad: elemento});
    }

    /**
     * Usado para poder obtener un valor de una entidad con cualquier nivel de anidamiento.
     * @example
     * let valor1 = this.obtenerValor(elemento, 'fecha.display');   // Equivale a: elemento.fecha.display
     * let valor2 = this.obtenerValor(elemento, 'persona.valor.apellidos');   // Equivale a: elemento.persona.valor.apellidos
     *
     * @param {Object}  elemento      -  Entidad que contiene el valor.
     * @param {string}   camino        -  Camino para llegar a la propiedad deseada, a partir de la raíz de la entidad que se pasa.
     * @return {Object}
     */
    obtenerValor(elemento, camino) {
        return get(elemento, camino, null);
    }

    /**
     * Devuelve si un orden está activo en la tabla o no.
     *
     * @param {Object} columna  -  Columna que se desea saber si está activa.
     * @param {string} modo     -  Puede ser 'asc' o 'desc'
     * @return {boolean}        -  Es verdadero si el orden pasado como parámetro está activo en la tabla.
     */
    ordenEstaActivo(columna, modo) {
        if (!isNil(columna)) {
            let campo = columna.nombre;
            if (typeof columna.ordenable === 'string' ) {
                campo = columna.ordenable;
            }
            return !isNil(this.ordenActivo) && this.ordenActivo[0] === campo && this.ordenActivo[1] === modo;
        }
        return false;
    }
}