import angular from 'angular';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import reduce from 'lodash/reduce';
import sortBy from 'lodash/sortBy';
import isMatchWith from 'lodash/isMatchWith';
import includes from 'lodash/includes';
import find from 'lodash/find';
import isNil from 'lodash/isNil';
import filter from 'lodash/filter';

import './etiquetas.scss';
import template from './modal-edicion-etiquetas.html';
import {ETIQUETA_NOK_DESC, ETIQUETA_OK_DESC, ETIQUETA_PENDIENTE} from '../../common/constantes';


/* @ngInject */
/**
 * Esta clase es un controlador de Angular para la vista de lista de etiquetas.
 */
export default class EtiquetasController {

    /**
     * @param $uibModal
     * @param toastr
     * @param {EtiquetasService} EtiquetasService
     * @param {ProcesosService} ProcesosService
     * @param {ActividadesService} ActividadesService
     * @param AppConfig
     *
     **/
    constructor($uibModal, toastr, EtiquetasService, ProcesosService, ActividadesService, AppConfig) {
        /** @private */
        this.ITEMS_SELECT = AppConfig.elementosBusquedaSelect;
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.etiquetasService = EtiquetasService;
        /** @private */
        this.actividadesService = ActividadesService;

        /** @type {boolean} */
        this.busquedaVisible = true;

        /** @private */
        this.totalProcesos = 0;
        /** @type {Proceso[]} */
        this.procesos = [];
        ProcesosService.obtenerTodos(false)
            .then(procesos => {
                /** @type {Proceso[]} */
                this.procesos = [].concat(...procesos);
                this.procesos.unshift({codigo: undefined, evento: ''});
            });
        ActividadesService.obtenerTodos(1, ['orden', 'asc'], null, 0)
            .then(actividades => {
                this.actividades = actividades;
            });

        this.estados = [ETIQUETA_PENDIENTE, ETIQUETA_OK_DESC, ETIQUETA_NOK_DESC];

        this.etiquetasService.obtenerTodos()
            .then(etiquetas => {
                let etiquetasOrdenadasPorCodigo = sortBy(etiquetas, ['codigo']);
                /** @type {Etiqueta[]} */
                this.etiquetas = etiquetasOrdenadasPorCodigo;
                /** @type {Etiqueta[]} */
                this.datos = etiquetasOrdenadasPorCodigo;
            });
        this.presentacion = {
            entidad: 'Etiqueta',
            atributoPrincipal: 'descripcion',
            ordenInicial: ['codigo', 'asc'],
            columnas: [
                {nombre: 'codigo', display: 'ID', ordenable: true},
                {nombre: 'proceso.display', display: 'Proceso', ordenable: true},
                {nombre: 'actividad.display', display: 'Actividad', ordenable: true},
                {nombre: 'descripcionEstado.ordenActividad', display: 'Orden', ordenable: true},
                {nombre: 'descripcionEstado.nombre', display: 'Estado', ordenable: true},
                {nombre: 'descripcion', display: 'Descripción', ordenable: true},
            ]
        };

        this.columnasExcel = {
            titulos: ['ID', 'Proceso', 'Actividad', 'Orden', 'Estado', 'Descripción'],
            campos: ['codigo', 'proceso.display', 'actividad.display', 'descripcionEstado.ordenActividad', 'descripcionEstado.nombre', 'descripcion']
        };
    }

    /**
     * Propiedad que devuelve true si no se está mostrando la lista completa de procesos en un momento determinado.
     * @return {boolean}
     */
    get mostrandoResultadosParcialesProcesos() {
        return this.totalProcesos > this.ITEMS_SELECT + 1;
    }

    /**
     * Filtra la lista de procesos según el string que haya escrito el usuario. Es case insensitive.
     * @param {string} busqueda
     * @return {Proceso[]}
     */
    filtrarProcesos(busqueda) {
        const busquedaLower = busqueda.toLowerCase();
        const resultado = filter(this.procesos, (elemento) => {
            return (busqueda && elemento.evento) ? includes(elemento.evento.toLowerCase(), busquedaLower) : true;
        });
        this.totalProcesos = resultado.length;

        if (resultado.length > this.ITEMS_SELECT + 1) {
            return resultado.slice(0, this.ITEMS_SELECT + 1);
        } else {
            return resultado;
        }
    }

    /**
     * Abre el modal que se utiliza para crear/editar una etiqueta. Cuando se termina de trabajar con la etiqueta,
     * actualiza o crea una fila correspondiente en la tabla.
     *
     * @param {Etiqueta} [etiqueta]   Si no se pasa una etiqueta, el modal se abre en modo de creación.
     */
    mostrarModalEtiqueta(etiqueta) {
        const contenedor = angular.element(document.getElementById('modalEdicionEtiqueta'));
        const modal = this.$uibModal.open({
            template,
            appendTo: contenedor,
            size: 'dialog-centered',    // hack para que el modal salga centrado verticalmente
            controller: 'ModalEdicionEtiquetasController',
            controllerAs: '$modal',
            resolve: {
                // Los elementos que se inyectan al controlador del modal se deben pasar de esta forma:
                entidad: () => { return etiqueta; },
                actividades: () => { return this.actividades; }
            }
        });

        modal.result.then((resultado) => {
            this.etiquetas = this.etiquetasService.etiquetas;
            if (this.busquedaActiva) {
                this.buscar();
            } else {
                this.datos = clone(this.etiquetas);
            }

            if (!isNil(resultado) && !isNil(resultado.codigo) && !this.filaEsVisible(resultado)) {
                this.toastr.warning('Aunque se guardaron los cambios, la etiqueta no está visible en la tabla en estos momentos.');
            }

            if (this.actividadesService.actividades.length === 0) {
                // Es necesario volver a pedir las actividades
                this.actividadesService.obtenerTodos(1, ['orden', 'asc'], null, 0)
                    .then(actividades => {
                        this.actividades = actividades;
                    });
            }
        });
        modal.result.catch(() => { });
    }

    /**
     * Edita los datos de una etiqueta.
     * @param {Etiqueta} etiqueta
     */
    editarEtiqueta(etiqueta) {
        let clon = cloneDeep(etiqueta);
        clon.proceso = etiqueta.proceso.valor;
        clon.actividad = etiqueta.actividad.valor;
        this.mostrarModalEtiqueta(clon);
    }

    /**
     * Elimina una etiqueta
     * @param {Etiqueta} etiqueta
     */
    eliminarEtiqueta(etiqueta) {
        const fnActualizarEtiquetas = () => {
            this.etiquetas = this.etiquetasService.etiquetas;
            if (this.busquedaActiva) {
                this.buscar();
            } else {
                this.datos = clone(this.etiquetas);
            }
        };

        return this.etiquetasService.eliminar(etiqueta)
            .then(() => {
                fnActualizarEtiquetas();
            })
            .catch(response => {
                if (response && response.status === 404) {
                    fnActualizarEtiquetas();
                }
                throw response;
            });
    }

    buscar() {
        if (Object.getOwnPropertyNames(this.paramsBusqueda).length === 0) {
            this.mostrarTodos();
        } else {
            this.busquedaActiva = true;
            this.datos = reduce(this.etiquetas, (resultado, item) => {
                let coincidencia = isMatchWith(item, this.paramsBusqueda, (objValue, srcValue, key, object) => {
                    if (key === 'descripcion') {
                        return objValue && includes(objValue.toLowerCase(), srcValue.toLowerCase());
                    } else if (key === 'proceso') {
                        return isNil(srcValue) || objValue.valor.id === srcValue.id;
                    } else if (key === 'estado') {
                        return isNil(srcValue) || object.descripcionEstado.nombre === srcValue;
                    }
                });
                if (coincidencia) {
                    resultado.push(item);
                }
                return resultado;
            }, []);
        }
    }

    mostrarTodos() {
        this.paramsBusqueda = {};
        this.busquedaActiva = false;
        this.datos = clone(this.etiquetas);
    }

    /**
     * Devuelve verdadero si la etiqueta está visible en la tabla en ese momento.
     * @param {Etiqueta} etiqueta
     * @return {boolean}
     */
    filaEsVisible(etiqueta) {
        if (isNil(etiqueta)) {
            return false;
        }
        return !!find(this.datos, (item) => {
            return item.codigo === etiqueta.codigo;
        });
    }
}