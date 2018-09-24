import angular from "angular";


/**
 * Contiene la directiva <custom-compile>, que compila el string que se le pase y lo convierte en HTML. Se utiliza en el
 * componente {@link Componentes.ge-tabla} para poder inyectar HTML en una celda de la tabla, si se desea.
 * @typedef {Object} Componentes.custom-compile
 *
 * @example
 * // Esto haría que se añadiera un enlace dentro del div en ejecución
 * <div class="contenedor-html" custom-compile="<a href="#home">Enlace</a>"></div>
 */
export default angular.module('custom-compile', [])
    .directive('customCompile', ['$compile', function ($compile) {

        return function(scope, element, attrs) {
            var ensureCompileRunsOnce = scope.$watch(
                function(scope) {
                    // se observa cuándo cambia la expresión 'customCompile'
                    return scope.$eval(attrs.customCompile);
                },
                function(value) {
                    // cuando la expresión 'customCompile' cambia, se asigna al DOM
                    element.html(value);

                    // se compila el nuevo DOM y se enlaza al scope actual.
                    // NOTA: sólo se compilan los .childNodes para no caer
                    // en un loop infinito compilándose la directiva a sí misma.
                    $compile(element.contents())(scope);

                    // Se quita el watcher de Angular para garantizar que la compilación pasa una vez nada más.
                    // ensureCompileRunsOnce();
                    // NOTA: Necesario comentar la línea de arriba para que funcionen bien las actualizaciones en la tabla
                }
            );
        };

    }]);