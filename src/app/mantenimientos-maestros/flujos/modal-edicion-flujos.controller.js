import isNil from 'lodash/isNil';
import get from 'lodash/get';
import find from 'lodash/find';

import {
    ELEMENTO_NO_ENCONTRADO,
    TITULO_CAMBIOS_GUARDADOS
} from "../../common/constantes";


/* @ngInject */
/**
 * Esta clase representa un controlador de Angular usado en el modal de creación/edición de un flujo.
 */
export default class ModalEdicionFlujosController {
    /**
     * @param $uibModalInstance
     * @param toastr
     * @param {FlujosService} FlujosService
     * @param {ModulosService} ModulosService
     * @param {Flujo} flujo
     */
    constructor($uibModalInstance, toastr, FlujosService, ModulosService, flujo) {
        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.flujosService = FlujosService;
        /** @type {Flujo} */
        this.flujo = flujo;

        if (isNil(this.flujo)) {
            /** @type {boolean} */
            this.modoEdicion = false;
            /** @type {string} */
            this.titulo = 'Nuevo Flujo';
            /** @type {string} */
            this.textoBoton = 'Crear';
        } else {
            this.modoEdicion = true;
            this.titulo = 'Actualizar Flujo';
            this.textoBoton = 'Actualizar';
        }

        ModulosService.obtenerTodos(true)
            .then(modulos => {
                /** @type {Modulo[]} */
                this.modulos = modulos;

                if (this.modoEdicion) {
                    let moduloAsociado = find(this.modulos, ['id', this.flujo.modulo.id]);
                    if (isNil(moduloAsociado)) {
                        this.modulos.push(this.flujo.modulo);
                    }
                }
            });
    }

    /**
     * Crea o edita un flujo, usando los datos que el usuario insertó en el formulario.
     *
     * @param edicionFlujoForm        - Formulario que contiene los datos de la entidad
     */
    editar(edicionFlujoForm) {
        if (edicionFlujoForm.$invalid) { return }

        let promesa;
        if (!this.modoEdicion) {
            promesa = this.flujosService.crear(this.flujo);
        } else {
            promesa = this.flujosService.editar(this.flujo);
        }
        promesa
            .then(resultado => {
                this.$uibModalInstance.close(resultado);
                this.toastr.success(`Flujo "${resultado.evento}"`, TITULO_CAMBIOS_GUARDADOS);
            })
            .catch(error => {
                if (get(error, 'error.errorCode') === ELEMENTO_NO_ENCONTRADO) {
                    this.toastr.warning('No se pudo encontrar el módulo relacionado con el flujo, por lo que no se guardaron los cambios.');
                }
                this.$uibModalInstance.close();
            });
    }

    /**
     * Cierra el modal de edición de tarifa.
     */
    cancelar() {
        this.$uibModalInstance.close();
    }
}