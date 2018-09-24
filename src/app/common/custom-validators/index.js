import angular from "angular";
import keys from 'lodash/keys';
import forEach from 'lodash/forEach';


/**
 * Contiene la directiva <custom-validators>, que permite añadir validadores extras a <input>. El objeto que se le pasa
 * a esta directiva debe tener la estructura: <br>
 *  {  llaveValidacion1: funcionValidacion1,  llaveValidacion2: funcionValidacion2  } <br>
 * Las funciones de validación reciben los parámetros 'modelValue' y 'viewValue' y deben retornar un boolean. Para más
 * información ver: {@link https://devdocs.io/angularjs~1.6/api/ng/type/ngmodel.ngmodelcontroller#$validators}
 * @typedef {Object} Componentes.custom-validators
 *
 * @example
 * <input name="nombre" ng-model="vm.entidad.nombre" custom-validators="{ duplicado: vm.validarNombreDuplicado }">
 */
export default angular.module('custom-validators', [])
    .directive('customValidators', () => {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: (scope, element, attrs, ngModelController) => {
                const validators = scope.$eval(attrs.customValidators);
                forEach( keys(validators), key => {
                    ngModelController.$validators[key] = validators[key].bind(scope);
                } );
            }
        }
    });