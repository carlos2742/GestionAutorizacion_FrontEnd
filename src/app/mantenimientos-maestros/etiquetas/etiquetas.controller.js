import angular from 'angular';
import clone from 'lodash/clone';
import cloneDeep from 'lodash/cloneDeep';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import sortBy from 'lodash/sortBy';
import isMatchWith from 'lodash/isMatchWith';
import includes from 'lodash/includes';
import find from 'lodash/find';
import isNil from 'lodash/isNil';

import './etiquetas.scss';
import template from './modal-edicion-etiquetas.html';
import {ETIQUETA_NOK_DESC, ETIQUETA_OK_DESC, ETIQUETA_PENDIENTE} from "../../common/constantes";

/* @ngInject */
/**
 * Esta clase es un controlador de Angular para la vista de lista de etiquetas.
 */
export default class EtiquetasController {

    /**
     * @param $uibModal
     * @param toastr
     * @param {EtiquetasService} EtiquetasService
     * @param {ModulosService} ModulosService
     *
     **/
    constructor($uibModal, toastr, EtiquetasService, ModulosService) {
        /** @private */
        this.$uibModal = $uibModal;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.etiquetasService = EtiquetasService;

        /** @type {boolean} */
        this.busquedaVisible = true;

        ModulosService.obtenerTodos(false)
            .then(modulos => {
                /** @type {Modulo[]} */
                this.modulos = modulos;
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
                {nombre: 'descripcion', display: 'Descripción', ordenable: true},
                {nombre: 'descripcionEstado.autorizacion', display: 'Autorización #', ordenable: true},
                {nombre: 'descripcionEstado.nombre', display: 'Estado', ordenable: true},
                {nombre: 'modulo.display', display: 'Módulo', ordenable: true},
            ]
        };

        this.columnasExcel = {
            titulos: ['ID', 'Descripción', 'Autorización #', 'Estado', 'Módulo'],
            campos: ['codigo', 'descripcion', 'descripcionEstado.autorizacion', 'descripcionEstado.nombre', 'modulo.display']
        }
    }

    /**
     * Abre el modal que se utiliza para crear/editar una etiqueta. Cuando se termina de trabajar con la etiqueta,
     * actualiza o crea una fila correspondiente en la tabla.
     *
     * @param {Etiqueta} [etiqueta]   Si no se pasa una etiqueta, el modal se abre en modo de creación.
     */
    mostrarModalEtiqueta(etiqueta) {
        const contenedor = angular.element(document.getElementById("modalEdicionEtiqueta"));
        const modal = this.$uibModal.open({
            template,
            appendTo: contenedor,
            size: 'dialog-centered',    // hack para que el modal salga centrado verticalmente
            controller: 'ModalEdicionEtiquetasController',
            controllerAs: '$modal',
            resolve: {
                // Los elementos que se inyectan al controlador del modal se deben pasar de esta forma:
                entidad: () => { return etiqueta }
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
        });
        modal.result.catch(() => { });
    }

    /**
     * Edita los datos de una etiqueta.
     * @param {Etiqueta} etiqueta
     */
    editarEtiqueta(etiqueta) {
        let clon = cloneDeep(etiqueta);
        clon.modulo = etiqueta.modulo.valor;
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
                    } else if (key === 'modulo') {
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