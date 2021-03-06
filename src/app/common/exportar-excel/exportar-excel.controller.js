import angular from 'angular';
import get from 'lodash/get';
import reduce from 'lodash/reduce';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import isBoolean from 'lodash/isBoolean';
import isNumber from 'lodash/isNumber';
import isNil from 'lodash/isNil';
import clone from 'lodash/clone';
import slice from 'lodash/slice';
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
        this.datosObtenidos = {
            total: 0
        };
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
                },
                datosObtenidos: () => {
                    return this.datosObtenidos;
                },
                activarRango: () => {
                    return this.activarRango;
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
     * @param $timeout
     * @param $rootScope
     * @param $scope
     * @param $uibModalInstance
     * @param toastr
     * @param AppConfig
     * @param datos
     * @param propiedades
     * @param fnObtencionDatos
     * @param datosObtenidos
     */
    constructor($timeout, $rootScope, $scope, $uibModalInstance, toastr, AppConfig, datos, propiedades, fnObtencionDatos, datosObtenidos, activarRango) {
        /** @private */
        this.ITEMS_POR_PAGINA_EXCEL = AppConfig.elementosPorPaginaParaExcel;
        /** @private */
        this.$timeout = $timeout;
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
        /** @private */
        this.datosObtenidos = datosObtenidos;

        this.activarRango = activarRango ? activarRango : false;
        this.rangoPagina = 1;
        this.ultimaPagina = Math.ceil(datos.length / AppConfig.elementosPorPagina);
        this.elementosPorPagina = AppConfig.elementosPorPagina;
        this.elementosExportar = AppConfig.elementosPorPaginaParaExcel * 200;

        this.excel = {};
        this.patronNombreArchivo = /^(?!\.)(?!com[0-9]$)(?!con$)(?!lpt[0-9]$)(?!nul$)(?!prn$)[^\|\*\?\\:<>/$"]*[^\.\|\*\?\\:<>/$"]+$/;
        this.exportacionEnProgreso = false;

        let deregister = $scope.$on('modal.closing', () => {
            deregister();
            this.datosObtenidos.total = 0;
        });
    }

    /**
     * Genera un documento Excel a partir de un conjunto de datos.
     *
     * @param nombreExcelForm   - Formulario donde el usuario insert?? el nombre del Excel
     */
    generarExcel(nombreExcelForm) {
        if (nombreExcelForm.$invalid || this.exportacionEnProgreso) {
            return;
        }
        this.datosObtenidos.activarRango = this.activarRango;
        this.datosObtenidos.rangoPagina = this.rangoPagina;
        this.exportacionEnProgreso = true;
        // Se simula una llamada al API para que la animaci??n en el bot??n funcione
        this.$rootScope.$emit('GestionAutorizacionAPI:request', 'POST');

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
            }).catch(() => {
                this.$rootScope.$emit('GestionAutorizacionAPI:responseError');
                this.exportacionEnProgreso = false;
                this.toastr.error('Se produjo un error mientras se exportaban los datos');
            })
            .finally(() => {
                this.$timeout(() => {
                    this.enProgreso = false;
                    this.$uibModalInstance.close();
                }, 500);
            });
        };
        // Si se pasa una funci??n as??ncrona para obtener los datos, se usa eso en vez del atributo 'datos' directamente
        if (!isNil(this.fnObtencionDatos)) {
            this.enProgreso = true;
            return this.fnObtencionDatos()
                .then(datos => {
                    return fnZipcelx(datos);
                })
                .catch(() => {
                    this.$timeout(() => { this.$uibModalInstance.close(); });
                });
        } else if (!isNil(this.datos)) {
            return fnZipcelx(this.datos);
        }

    }

    get progresoObtencionDatos() {
        return this.datosObtenidos.total / this.procesarDatosParticionar() * 100;
    }

    procesarDatosParticionar() {
        if(this.activarRango) {
            if(this.datos.length > this.elementosExportar) {
                return this.elementosExportar;
            } else if(this.rangoPagina > 1) {
                let clon = clone(this.datos);
                clon = slice(clon, 0, (this.rangoPagina - 1) * this.elementosPorPagina);
                return this.datos.length - clon.length;
            }
        }
        return this.datos.length;
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
                    valor = valor ? 'S??' : 'No';
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