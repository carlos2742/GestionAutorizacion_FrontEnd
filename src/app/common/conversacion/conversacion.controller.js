import isSameDay from 'date-fns/isSameDay';
import isNil from "lodash/isNil";
import find from "lodash/find";
import get from "lodash/get";


/* @ngInject */
/**
 * Esta clase representa un controlador de Angular correspondiente al componente <conversacion>
 */
export default class ConversacionController {
    /**
     * @param $attrs
     *
     **/
    constructor($attrs) {
        /** @private */
        this.$attrs = $attrs;

        /** @type {boolean} */
        this.mostrarLoader = true;
    }

    $onChanges(cambios) {
        if (cambios.mensajes) {
            if ((cambios.mensajes.isFirstChange() || isNil(cambios.mensajes.previousValue)) && !isNil(cambios.mensajes.currentValue)) {
                this.mostrarLoader = false;
            } else if (!isNil(cambios.mensajes.previousValue) && isNil(cambios.mensajes.currentValue)) {
                this.mostrarLoader = true;
            }
        }
    }

    mostrarSeparadorFecha(indiceMensaje) {
        return indiceMensaje === 0 || !isSameDay(this.mensajes[indiceMensaje].fechaEnvio.valor, this.mensajes[indiceMensaje - 1].fechaEnvio.valor);
    }
}