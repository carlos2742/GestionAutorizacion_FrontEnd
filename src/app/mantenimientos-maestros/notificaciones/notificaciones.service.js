import isNil from 'lodash/isNil';
import isUndefined from 'lodash/isUndefined';
import isEqual from 'lodash/isEqual';
import clone from 'lodash/clone';
import get from 'lodash/get';
import map from 'lodash/map';
import fill from 'lodash/fill';
import forEach from 'lodash/forEach';
import findIndex from 'lodash/findIndex';
import assign from 'lodash/assign';
import format from "date-fns/format";

import { elementoRequeridoEsNulo } from '../../common/validadores';
import { procesarFechaAEnviar } from '../../common/utiles';

/* @ngInject */
/**
 * Esta clase es un servicio de Angular donde se almacena la lista de todas las notificaciones disponibles.
 */
export default class NotificacionesService {
    constructor($q, $http, ErroresValidacionMaestros, AppConfig) {
        this.ENDPOINT = '/notificaciones';
        this.$q = $q;
        this.$http = $http;
        this.erroresValidacionMaestros = ErroresValidacionMaestros;
        this.appConfig = AppConfig;

        this.notificaciones = [];
        this.ordenActivo = null;
        this.filtrosBusqueda = null;
        this.datosPaginador = null;
    }

    obtenerEstados() {
        return [
            {id: 1, nombre: 'Activo', valor: true},
            {id: 2, nombre: 'Inactivo', valor: false},
            {id: 3, nombre: '', valor: undefined}
        ];
    }

    reset() {
        this.notificaciones = [];
        this.ordenActivo = null;
        this.filtrosBusqueda = null;
        this.datosPaginador = null;
    }

    procesarEntidadRecibida(entidad) {
        let notificacionAProcesar = {
            codigo: entidad.id,
            editable: true,
            eliminable: true
        };
        notificacionAProcesar['id'] = entidad['id'];
        notificacionAProcesar['activo'] = entidad['activo'];
        notificacionAProcesar['mensaje'] = entidad['mensaje'];
        notificacionAProcesar['idPeticion'] = entidad['idPeticion'];
        notificacionAProcesar['peticion'] = entidad['peticion'];

        if(entidad.hasOwnProperty('fechaInicio')) {
            const fechaInicio = entidad.fechaInicio ? new Date(Date.parse(entidad.fechaInicio)) : null;
            let hora = fechaInicio.getHours();
            let minuto = fechaInicio.getMinutes();
            let meridiano = hora >= 12 ? 'pm' : 'am';
            hora = hora % 12;
            hora = hora ? hora : 12;
            minuto = minuto < 10 ? '0' + minuto : minuto;
            const horaInicio = hora + ':' + minuto + ' ' + meridiano;
            notificacionAProcesar['fechaInicio'] = {
                valor: fechaInicio,
                display: fechaInicio ? format(fechaInicio, this.appConfig.formatoFechas) : '',
                displayHoraInicio: horaInicio ? horaInicio : ''
            };
        }
        if(entidad.hasOwnProperty('fechaFin')) {
            const fechaFin = entidad.fechaFin ? new Date(Date.parse(entidad.fechaFin)) : null;
            let hora = fechaFin.getHours();
            let minuto = fechaFin.getMinutes();
            let meridiano = hora >= 12 ? 'pm' : 'am';
            hora = hora % 12;
            hora = hora ? hora : 12;
            minuto = minuto < 10 ? '0' + minuto : minuto;
            const horaFin = hora + ':' + minuto + ' ' + meridiano;
            notificacionAProcesar['fechaFin'] = {
                valor: fechaFin,
                display: fechaFin ? format(fechaFin, this.appConfig.formatoFechas) : '',
                displayHoraFin: horaFin ? horaFin : ''
            };
        }
        if(entidad.hasOwnProperty('solicitante')) {
            if(!isNil(entidad.solicitante)) {
                notificacionAProcesar['solicitante'] = {
                    valor: entidad.solicitante,
                    display: `${entidad.solicitante.nombre} ${entidad.solicitante.apellidos}`
                };
            }
        }
        return notificacionAProcesar;
    }

    _procesarResultadosPaginados(resultados, total, inicio) {
        this.notificaciones = [];
        this.notificaciones.push(... fill(Array(total), undefined));
        forEach(resultados, (notificacion, indice) => {
            this.notificaciones[indice + inicio] = notificacion;
        });
    }

    obtenerTodos(pagina, orden, filtro, elementosPorPagina, persistirResultado) {
        let totalnotificaciones = 0;
        const paginaActual = !isNil(pagina) ? pagina : 1;
        const fin = paginaActual * this.appConfig.elementosPorPagina;
        const inicio = fin - this.appConfig.elementosPorPagina;
        const guardarCambios = isNil(persistirResultado) || persistirResultado;
        if (guardarCambios && !isNil(orden) && (isNil(this.ordenActivo) || orden[0] !== this.ordenActivo[0] || orden[1] !== this.ordenActivo[1])) {
            this.notificaciones = [];
            this.ordenActivo = orden;
        }
        let ordenarPor;
        const ordenSeleccionado = orden || this.ordenActivo;
        if (!isNil(ordenSeleccionado)) {
            let campoAOrdenar = ordenSeleccionado[0];
            // Se hace esto por si el campo por el que se ordena es 'fecha.valor', por ejemplo
            campoAOrdenar = campoAOrdenar.split('.')[0];
            // El API interpreta como orden descendente si se pasa el parámetros con un - delante, ejemplo: -fecha
            ordenarPor = `${ordenSeleccionado[1] === 'desc' ? '-' : ''}${campoAOrdenar}`;
        }
        let filtroSeleccionado = this.filtrosBusqueda;
        if (filtro === null || (!isUndefined(filtro) && !isEqual(this.filtrosBusqueda, filtro))) {
            filtroSeleccionado = filtro;
            if (guardarCambios) {
                this.filtrosBusqueda = filtro;
            }
        }
        const parametrosEnviar = assign({
            paginaActual,
            elementosPorPagina: !isNil(elementosPorPagina) ? elementosPorPagina : this.appConfig.elementosPorPagina,
            ordenarPor
        }, filtroSeleccionado);
        return this.$http.get(this.ENDPOINT, { params: parametrosEnviar })
            .then(response => {
                this.datosPaginador = clone(response.metadata);
                totalnotificaciones = this.datosPaginador['cantidadTotal'];
                const notificaciones = map(response.data, notificacion => { return this.procesarEntidadRecibida(notificacion); });
                if (guardarCambios) {
                    this._procesarResultadosPaginados(notificaciones, totalnotificaciones, inicio);
                }
                return notificaciones;
            });
    }

    _validarEntidad(entidad) {
        if (elementoRequeridoEsNulo(entidad.mensaje)) {
            return this.$q.reject(this.erroresValidacionMaestros.FALTA_REQUERIDO);
        } else if (elementoRequeridoEsNulo(entidad.activo)) {
            return this.$q.reject(this.erroresValidacionMaestros.FALTA_REQUERIDO);
        } else if (elementoRequeridoEsNulo(entidad.fechaInicio)) {
            return this.$q.reject(this.erroresValidacionMaestros.FALTA_REQUERIDO);
        } else if (elementoRequeridoEsNulo(entidad.fechaFin)) {
            return this.$q.reject(this.erroresValidacionMaestros.FALTA_REQUERIDO);
        }
        return this.$q.resolve();
    }

    crear(entidad) {
        return this._validarEntidad(entidad)
            .then(() => {
                const datosAEnviar = clone(entidad);
                return this.$http.post(this.ENDPOINT, datosAEnviar);
            })
            .then(response => {
                let nuevaNotificacion = this.procesarEntidadRecibida(response.data);
                this.notificaciones.push(nuevaNotificacion);
                return nuevaNotificacion;
            });
    }

    _indiceEntidadCambiada(notificacionProcesada) {
        if (isNil(notificacionProcesada)) { return -1; }
        let iguales = true;
        let indiceExistente = findIndex(this.notificaciones, ['id', notificacionProcesada.id]);
        if(indiceExistente >= 0) {
            const noticia = this.notificaciones[indiceExistente];
            if(get(notificacionProcesada, 'mensaje') !== get(noticia, 'mensaje')) {
                iguales = false;
            } else if(get(notificacionProcesada, 'activo') !== get(noticia, 'activo')) {
                iguales = false;
            } else if(get(notificacionProcesada, 'fechaInicio.display') !== get(noticia, 'fechaInicio.display')) {
                iguales = false;
            } else if(get(notificacionProcesada, 'fechaFin.display') !== get(noticia, 'fechaFin.display')) {
                iguales = false;
            } else if(get(notificacionProcesada, 'fechaInicio.displayHoraInicio') !== get(noticia, 'fechaInicio.displayHoraInicio')) {
                iguales = false;
            } else if(get(notificacionProcesada, 'fechaFin.displayHoraFin') !== get(noticia, 'fechaFin.displayHoraFin')) {
                iguales = false;
            }
        }
        return iguales ? -1 : indiceExistente;
    }

    _posicionarNotificacionCambiada(notificacionCambiada, paginaActual) {
        return this.obtenerTodos(paginaActual)
            .then(notificaciones => {
                let indexEval = findIndex(notificaciones, ['id', notificacionCambiada.id]);
                let pagina = indexEval < 0 ? -1 : paginaActual;
                return { pagina, notificacionesPagina: notificaciones };
            });
    }

    _eliminarEntidad(notificacion) {
        let indiceExistente = findIndex(this.notificaciones, ['id', notificacion.id]);
        if (indiceExistente > -1) {
            this.notificaciones.splice(indiceExistente, 1);
        }
    }

    editar(entidad, paginaActual) {
        const datosNotificacionEditar = {
            id: entidad.id,
            mensaje: entidad.mensaje,
            activo: entidad.activo,
            fechaInicio: procesarFechaAEnviar(entidad.fechaInicio.valor),
            fechaFin: procesarFechaAEnviar(entidad.fechaFin.valor),
            idPeticion: get(entidad, 'idPeticion') ? entidad.idPeticion : undefined
        };
        const entidadAProcesar = clone(datosNotificacionEditar);
        entidadAProcesar['fechaInicio'] = entidad.fechaInicio.valor;
        entidadAProcesar['fechaFin'] = entidad.fechaFin.valor;
        entidadAProcesar['solicitante'] = get(entidad, 'solicitante.valor') ? entidad.solicitante.valor : undefined;
        let notificacionEditada;
        return this._validarEntidad(datosNotificacionEditar)
            .then(() => {
                const notificacionProcesada = this.procesarEntidadRecibida(entidadAProcesar);
                let indiceExistente = this._indiceEntidadCambiada(notificacionProcesada);
                // Si los datos no han cambiado se rechaza la edición
                if (indiceExistente >= 0) {
                    return this.$http.put(`${this.ENDPOINT}/${datosNotificacionEditar.id}`, datosNotificacionEditar)
                        .then(() => {
                            notificacionEditada = notificacionProcesada;
                            return this._posicionarNotificacionCambiada(notificacionEditada, paginaActual);
                        })
                        .then(resultado => {
                            return { notificacion: notificacionEditada, pagina: resultado.pagina, notificacionesPagina: resultado.notificacionesPagina };
                        })
                        .catch(response => {
                            // Si el API devuelve que no encontró esa entidad, se elimina de la lista local
                            if (response && response.status === 404) {
                                this._eliminarEntidad(entidad);
                            }
                            throw response;
                        });
                } else {
                    return this.$q.reject();
                }
            });
    }

    eliminar(notificacion) {
        let indiceExistente = findIndex(this.notificaciones, ['id', notificacion.id]);
        if (indiceExistente < 0 ){ return this.$q.reject(); }
        return this.$http.delete(`${this.ENDPOINT}/${notificacion.id}`)
            .then(() => {
                this._eliminarEntidad(notificacion);
                return notificacion;
            }).catch(response => {
                // Si en el servidor no se encontró una entidad con este código, se quita de la lista local
                if (response.status === 404) {
                    this._eliminarEntidad(notificacion);
                    throw response;
                } else {
                    throw response;
                }
            });
    }

    editarExterno(entidad) {
        const datosNotificacionEditar = {
            id: entidad.id,
            mensaje: entidad.mensaje,
            activo: entidad.activo,
            fechaInicio: procesarFechaAEnviar(entidad.fechaInicio.valor),
            fechaFin: procesarFechaAEnviar(entidad.fechaFin.valor),
            idPeticion: get(entidad, 'idPeticion') ? entidad.idPeticion : undefined
        };
        return this.$http.put(`${this.ENDPOINT}/${datosNotificacionEditar.id}`, datosNotificacionEditar)
            .then(resultado => {
                return resultado.data;
            })
            .catch(response => {
                if (response && response.status === 404) {
                    this._eliminarEntidad(entidad);
                }
                throw response;
            });
    }
}
