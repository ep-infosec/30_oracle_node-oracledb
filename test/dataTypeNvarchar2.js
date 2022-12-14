/* Copyright (c) 2015, 2022, Oracle and/or its affiliates. */

/******************************************************************************
 *
 * You may not use the identified files except in compliance with the Apache
 * License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * NAME
 *   25. dataTypeNvarchar2.js
 *
 * DESCRIPTION
 *    Testing Oracle data type support - VARCHAR2.
 *
 *****************************************************************************/
'use strict';

var oracledb = require('oracledb');
var should   = require('should');
var assist   = require('./dataTypeAssist.js');
var dbConfig = require('./dbconfig.js');

describe('25. dataTypeNvarchar2.js', function() {

  var connection = null;
  var tableName = "nodb_nvarchar2";

  var strLen = [10, 100, 1000, 2000]; // char string length
  var strs = [];
  for (var i = 0; i < strLen.length; i++)
    strs[i] = assist.createCharString(strLen[i]);

  before('get one connection', function(done) {
    oracledb.getConnection(
      {
        user:          dbConfig.user,
        password:      dbConfig.password,
        connectString: dbConfig.connectString
      },
      function(err, conn) {
        should.not.exist(err);
        connection = conn;
        done();
      }
    );
  });

  after('release connection', function(done) {
    connection.release(function(err) {
      should.not.exist(err);
      done();
    });
  });

  describe('25.1 testing NVARCHAR2 data in various lengths', function() {

    before('create table, insert data', function(done) {
      assist.setUp(connection, tableName, strs, done);
    });

    after(function(done) {
      connection.execute(
        "DROP table " + tableName + " PURGE",
        function(err) {
          should.not.exist(err);
          done();
        }
      );
    });

    it('25.1.1 SELECT query', function(done) {
      assist.dataTypeSupport(connection, tableName, strs, done);
    });

    it('25.1.2 resultSet stores NVARCHAR2 data correctly', function(done) {
      assist.verifyResultSet(connection, tableName, strs, done);
    });

    it('25.1.3 works well with REF Cursor', function(done) {
      assist.verifyRefCursor(connection, tableName, strs, done);
    });

    it('25.1.4 columns fetched from REF CURSORS can be mapped by fetchInfo settings', function(done) {
      assist.verifyRefCursorWithFetchInfo(connection, tableName, strs, done);
    });
  });

  describe('25.2 stores null value correctly', function() {
    it('25.2.1 testing Null, Empty string and Undefined', function(done) {
      assist.verifyNullValues(connection, tableName, done);
    });
  });

});
