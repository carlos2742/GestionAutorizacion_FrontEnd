import angular from 'angular';

import PersonalService from './personal.service';
import SesionService from './sesion.service';


export default angular.module('personal', [])
    .service('PersonalService', PersonalService)
    .service('SesionService', SesionService);