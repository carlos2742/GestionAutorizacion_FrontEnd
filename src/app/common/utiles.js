import isNil from 'lodash/isNil';
import isDate from 'lodash/isDate';
import addMinutes from 'date-fns/addMinutes';


export function procesarFechaAEnviar(fecha) {
    if (isNil(fecha) || !isDate(fecha)) {
        return "";
    }

    if (fecha.getUTCHours() !== 0) {
        const diferenciaTZ = fecha.getTimezoneOffset();
        fecha = addMinutes(fecha, -1 * diferenciaTZ);
    }

    const isoRep = fecha.toISOString();
    return isoRep.substr(0, isoRep.length - 1);
}