import angular from 'angular';
import accordion from "ui-bootstrap4/src/accordion";
import pagination from "ui-bootstrap4/src/pagination";
import 'angular-bootstrap-toggle/dist/angular-bootstrap-toggle.js';

import geTablaModule from '../common/ge-tabla';
import personalModule from '../common/personal';

import PermisosAdminService from './permisos-admin.service';
import PermisosAdminController from './permisos-admin.controller';


export default angular.module('permisos-admin', [
    accordion,
    pagination,
    'ui.toggle',

    geTablaModule.name,
    personalModule.name
])
    .service('PermisosAdminService', PermisosAdminService)
    .controller('PermisosAdminController', PermisosAdminController);