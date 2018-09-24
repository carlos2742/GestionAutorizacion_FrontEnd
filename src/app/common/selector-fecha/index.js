import angular from 'angular';
import isNil from 'lodash/isNil';
import isSameDay from 'date-fns/isSameDay';
import isBefore from 'date-fns/isBefore';
import addMinutes from 'date-fns/addMinutes';
import datepickerPopup from "ui-bootstrap4/src/datepickerPopup";
import tooltip from "ui-bootstrap4/src/tooltip";

import html from './selector-fecha.html';
import './selector-fecha.scss';


/**
 * Contiene el componente <selector-fecha>, que se usa para seleccionar las fechas en la interfaz.
 * @typedef {Object} Componentes.selector-fecha
 * @property {string} clasesExtra       -  Clases de CSS que se añaden al div que contiene el input de la fecha.
 * @property {string} name              -  Valor del atributo 'name' e 'id' del input de la fecha.
 * @property {string} placeholder       -  Valor del atributo 'placeholder' del input de la fecha.
 * @property {Object} model             -  Valor del atributo 'ng-model' del input de la fecha.
 * @property {boolean} requerido        -  Se debe pasar en verdadero si el input debe tener el atributo 'required'.
 * @property {boolean} deshabilitado    -  Se debe pasar en verdadero si el input debe tener el atributo 'disabled'.
 * @property {boolean} minHoy           -  Se debe pasar en verdadero si se debe aplicar la restricción de que la fecha
 *                                         seleccionada debe ser mayor o igual que la actual.
 *
 * @example
 * <selector-fecha clases-extra="clase1 clase2"
 *    name="fecha"
 *    placeholder="Fecha"
 *    model="$modal.formacion.fecha"
 *    requerido="true"
 *    min-hoy=":: !$modal.modoEdicion"></selector-fecha>
 */
export default angular.module('selector-fecha', [datepickerPopup, tooltip])

    .component('selectorFecha', {
        bindings: {
            clasesExtra: '@',
            name: '@',
            placeholder: '@',
            model: '=',
            requerido: '<',
            deshabilitado: '<',
            minHoy: '<'
        },
        template: html,
        controller: function ($scope, $element) {
            'ngInject';

            this.popupFechaAbierto = false;

            this.$postLink = function () {
                const modelCtrl = $element.find('input').controller('ngModel');
                if (this.minHoy) {
                    modelCtrl.$validators.fechaPasada = (valorModelo, valorVista) => {
                            let valor = valorModelo || valorVista;
                            return isSameDay(new Date(), valor) || isBefore(new Date(), valor);
                        };
                }
                modelCtrl.$formatters.push(value => {
                    if (!isNil(value)) {
                        const diferenciaMinutos = value.getTimezoneOffset();
                        return addMinutes(value, -1 * diferenciaMinutos);
                    } else {
                        return value;
                    }
                });
                modelCtrl.$parsers.push(value => {
                    if (!isNil(value)) {
                        return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
                    } else {
                        return value;
                    }
                });
            };

            this.toggleSelectorFecha = () => {
                this.popupFechaAbierto = !this.popupFechaAbierto;
            };
        },
    });