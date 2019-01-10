import isSameDay from 'date-fns/isSameDay';


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
    }

    mostrarSeparadorFecha(indiceMensaje) {
        return indiceMensaje === 0 || !isSameDay(this.mensajes[indiceMensaje].fechaEnvio.valor, this.mensajes[indiceMensaje - 1].fechaEnvio.valor);
    }
}