
'use strict';

var async = require('async');
const _ = require('lodash');

const user = require('../user');
const groups = require('../groups');
var helpers = require('./helpers');
var plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.admin = {};

	privileges.admin.privilegeLabels = [
		{ name: '[[admin/manage/privileges:acp.general]]' },
		{ name: '[[admin/manage/privileges:acp.manage]]' },
		{ name: '[[admin/manage/privileges:acp.settings]]' },
		{ name: '[[admin/manage/privileges:acp.privileges]]' },
		{ name: '[[admin/manage/privileges:acp.appearance]]' },
		{ name: '[[admin/manage/privileges:acp.extend]]' },
		{ name: '[[admin/manage/privileges:acp.advanced]]' },
	];

	privileges.admin.userPrivilegeList = [
		'acp:general',
		'acp:manage',
		'acp:settings',
		'acp:privileges',
		'acp:appearance',
		'acp:extend',
		'acp:advanced',
	];

	privileges.admin.groupPrivilegeList = privileges.admin.userPrivilegeList.map(function (privilege) {
		return 'groups:' + privilege;
	});

	privileges.admin.list = function (callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					labels: function (next) {
						async.parallel({
							users: async.apply(plugins.fireHook, 'filter:privileges.admin.list_human', privileges.admin.privilegeLabels.slice()),
							groups: async.apply(plugins.fireHook, 'filter:privileges.admin.groups.list_human', privileges.admin.privilegeLabels.slice()),
						}, next);
					},
					users: function (next) {
						helpers.getUserPrivileges('acp', 'filter:privileges.admin.list', privileges.admin.userPrivilegeList, next);
					},
					groups: function (next) {
						helpers.getGroupPrivileges('acp', 'filter:privileges.admin.groups.list', privileges.admin.groupPrivilegeList, next);
					},
				}, next);
			},
			function (payload, next) {
				// This is a hack because I can't do {labels.users.length} to echo the count in templates.js
				payload.columnCountUser = payload.labels.users.length + 2;
				payload.columnCountGroup = payload.labels.groups.length + 2;
				next(null, payload);
			},
		], callback);
	};

	privileges.admin.get = function (uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					privileges: function (next) {
						helpers.isUserAllowedTo(privileges.admin.userPrivilegeList, uid, 'acp', next);
					},
					isAdministrator: function (next) {
						user.isAdministrator(uid, next);
					},
				}, next);
			},
			function (results, next) {
				var privData = _.zipObject(privileges.admin.userPrivilegeList, results.privileges);
				const payload = {};
				privileges.admin.userPrivilegeList.forEach((privilege) => {
					payload[privilege] = privData[privilege] || results.isAdministrator;
				});

				plugins.fireHook('filter:privileges.admin.get', payload, next);
			},
		], callback);
	};

	privileges.admin.can = function (privilege, uid, callback) {
		helpers.some([
			function (next) {
				helpers.isUserAllowedTo(privilege, uid, ['acp'], function (err, results) {
					next(err, Array.isArray(results) && results.length ? results[0] : false);
				});
			},
			function (next) {
				user.isAdministrator(uid, next);
			},
		], callback);
	};

	privileges.admin.canGroup = function (privilege, groupName, callback) {
		groups.isMember(groupName, 'cid:acp:privileges:groups:' + privilege, callback);
	};
};