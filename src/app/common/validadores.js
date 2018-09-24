import isNil from 'lodash/isNil';
import findIndex from 'lodash/findIndex';
import differenceInCalendarDays from 'date-fns/differenceInCalendarDays';


export function elementoRequeridoEsNulo(elemento) {
    return isNil(elemento);
}

export function elementoYaExiste(elemento, prop, lista) {
    return !isNil(elemento)
        && !isNil(elemento[prop])
        && findIndex(lista, (item) => {
            return item[prop] === elemento[prop] && (isNil(elemento.codigo) || item.codigo !== elemento.codigo);
        }) > -1;
}

export function primeraFechaAnteriorASegunda(primeraFecha, segundaFecha) {
    return differenceInCalendarDays(primeraFecha, segundaFecha) < 0;
}