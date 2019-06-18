import angular from 'angular';
import get from 'lodash/get';
import reduce from 'lodash/reduce';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import isBoolean from 'lodash/isBoolean';
import isNumber from 'lodash/isNumber';
import isNil from 'lodash/isNil';
import zipcelx from 'zipcelx';


/* @ngInject */
/**
 * Esta clase contiene el controlador de Angular del componente que se usa para exportar los datos de una tabla a un Excel.
 */
export default class ExportarExcelController {

    /**
     * @param $attrs
     * @param $uibModal
     *
     */
    constructor($attrs, $uibModal) {
        /** @private */
        this.$attrs = $attrs;
        /** @private */
        this.$uibModal = $uibModal;
    }

    $onInit() {
        this.fnObtencionDatosDefinida = !!this.$attrs.fnObtencionDatos;
        this.datosDefinidos = !!this.$attrs.datos;
    }

    /**
     * Muestra el modal donde se pone el nombre que va a tener el documento Excel cuando se genere.
     */
    mostrarModalExcel() {
        const contenedor = angular.element(document.getElementById("modalExcel"));
        this.$uibModal.open({
            templateUrl: 'exportarExcel.html',
            appendTo: contenedor,
            controller: 'ModalExcelController',
            controllerAs: '$modal',
            resolve: {
                datos: () => {
                    if (this.datosDefinidos) {
                        return this.datos;
                    } else {
                        return null;
                    }
                },
                propiedades: () => { return this.propiedades; },
                fnObtencionDatos: () => {
                    if (this.fnObtencionDatosDefinida) {
                        return this.fnObtencionDatos;
                    } else {
                        return null;
                    }
                }
            }
        }).result.catch(() => {

        });
    }
}


/**
 * Esta clase contiene el controlador de Angular del modal donde se pone el nombre del documento Excel que se va a exportar.
 */
export class ModalExcelController {

    /* @ngInject */
    /**
     * @param $rootScope
     * @param $uibModalInstance
     * @param toastr
     * @param datos
     * @param propiedades
     * @param fnObtencionDatos
     *
     */
    constructor($rootScope, $uibModalInstance, toastr, datos, propiedades, fnObtencionDatos) {
        /** @private */
        this.$rootScope = $rootScope;
        /** @private */
        this.$uibModalInstance = $uibModalInstance;
        /** @private */
        this.toastr = toastr;
        /** @private */
        this.datos = datos;
        /** @private */
        this.propiedades = propiedades;
        /** @private */
        this.fnObtencionDatos = fnObtencionDatos;

        this.excel = {};
        this.patronNombreArchivo = /^(?!\.)(?!com[0-9]$)(?!con$)(?!lpt[0-9]$)(?!nul$)(?!prn$)[^\|\*\?\\:<>/$"]*[^\.\|\*\?\\:<>/$"]+$/;
        this.exportacionEnProgreso = false;
    }

    /**
     * Genera un documento Excel a partir de un conjunto de datos.
     *
     * @param nombreExcelForm   - Formulario donde el usuario insertó el nombre del Excel
     */
    generarExcel(nombreExcelForm) {
        if (nombreExcelForm.$invalid || this.exportacionEnProgreso) {
            return;
        }

        this.exportacionEnProgreso = true;
        // Se simula una llamada al API para que la animación en el botón funcione
        this.$rootScope.$emit('GestionAutorizacionAPI:request');

        const fnZipcelx = (datos) => {
            let celdas = this._generarDatosExcel(datos);
            zipcelx({
                filename: this.excel.nombre,
                sheet: {
                    data: celdas
                }
            }).then(() => {
                this.$rootScope.$emit('GestionAutorizacionAPI:response');
                this.exportacionEnProgreso = false;
                this.$uibModalInstance.close();
            }).catch(() => {
                this.$rootScope.$emit('GestionAutorizacionAPI:responseError');
                this.exportacionEnProgreso = false;
                this.$uibModalInstance.close();
                this.toastr.error('Se produjo un error mientras se exportaban los datos');
            });
        };

        // Si se pasa una función asíncrona para obtener los datos, se usa eso en vez del atributo 'datos' directamente
        if (!isNil(this.fnObtencionDatos)) {
            return this.fnObtencionDatos()
                .then(datos => {
                    return fnZipcelx(datos);
                })
        } else if (!isNil(this.datos)) {
            return fnZipcelx(this.datos);
        }

    }

    /**
     * Genera la estructura que utiliza la ZipcelX para generar los documentos Excel, a partir de un arreglo de datos.
     *
     * @param datos
     * @return {Object}
     * @private
     */
    _generarDatosExcel(datos) {
        // La primera fila del Excel contiene los nombres de las columnas
        let filaTitulos = map(this.propiedades.titulos, (titulo) => {
            return {
                value: titulo,
                type: 'string'
            }
        });

        return reduce(datos, (resultado, item) => {
            let fila = [];

            forEach(this.propiedades.campos, (prop) => {
                let valor = get(item, prop);
                if (!isNil(valor) && isBoolean(valor)) {
                    valor = valor ? 'Sí' : 'No';
                }
                fila.push({
                    value: !isNil(valor) ? valor : '',
                    type: !isNil(valor) && isNumber(valor) ? 'number' : 'string'
                });
            });

            resultado.push(fila);
            return resultado;
        }, [filaTitulos]);
    }

    /**
     * Cierra el modal.
     */
    cancelar() {
        this.$uibModalInstance.close();
    }
}