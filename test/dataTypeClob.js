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
 *   40. dataTypeClob.js
 *
 * DESCRIPTION
 *    Testing Oracle data type support - CLOB.
 *    This test corresponds to example files:
 *         clobinsert1.js, clobstream1.js and clobstream2.js
 *    Firstly, reads text from clobexample.txt and INSERTs it into a CLOB column.
 *    Secondly, SELECTs a CLOB and pipes it to a file, clobstreamout.txt
 *    Thirdly, SELECTs the CLOB and compares it with the content in clobexample.txt.
 *    Fourthly, query the CLOB with Object outFormat.
 *
 *****************************************************************************/
'use strict';

var oracledb = require('oracledb');
var fs       = require('fs');
var async    = require('async');
var should   = require('should');
var dbConfig = require('./dbconfig.js');
var assist   = require('./dataTypeAssist.js');

var inFileName = 'test/clobexample.txt';  // the file with text to be inserted into the database
var outFileName = 'test/clobstreamout.txt';

describe('40. dataTypeClob.js', function() {

  var connection = null;
  var tableName = "nodb_myclobs";

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

  describe('40.1 testing CLOB data type', function() {
    before('create table', function(done) {
      assist.createTable(connection, tableName, done);
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

    it('40.1.1 stores CLOB value correctly', function(done) {
      connection.should.be.ok();
      async.series([
        function clobinsert1(callback) {

          connection.execute(
            "INSERT INTO nodb_myclobs (num, content) VALUES (:n, EMPTY_CLOB()) RETURNING content INTO :lobbv",
            { n: 1, lobbv: {type: oracledb.CLOB, dir: oracledb.BIND_OUT} },
            { autoCommit: false },  // a transaction needs to span the INSERT and pipe()
            function(err, result) {
              should.not.exist(err);
              (result.rowsAffected).should.be.exactly(1);
              (result.outBinds.lobbv.length).should.be.exactly(1);

              var inStream = fs.createReadStream(inFileName);
              var lob = result.outBinds.lobbv[0];

              lob.on('error', function(err) {
                should.not.exist(err, "lob.on 'error' event");
              });

              inStream.on('error', function(err) {
                should.not.exist(err, "inStream.on 'error' event");
              });

              lob.on('finish', function() {
                // now commit updates
                connection.commit(function(err) {
                  should.not.exist(err);
                  callback();
                });
              });

              inStream.pipe(lob); // copies the text to the CLOB
            }
          );
        },
        function clobstream1(callback) {
          connection.execute(
            "SELECT content FROM nodb_myclobs WHERE num = :n",
            { n: 1 },
            function(err, result) {
              should.not.exist(err);

              var lob = result.rows[0][0];
              should.exist(lob);
              lob.setEncoding('utf8');

              lob.on('error', function(err) {
                should.not.exist(err, "lob.on 'error' event");
              });

              var outStream = fs.createWriteStream(outFileName);
              outStream.on('error', function(err) {
                should.not.exist(err, "outStream.on 'error' event");
              });

              lob.pipe(outStream);

              outStream.on('finish', function() {

                fs.readFile(inFileName, { encoding: 'utf8' }, function(err, originalData) {
                  should.not.exist(err);

                  fs.readFile(outFileName, { encoding: 'utf8' }, function(err, generatedData) {
                    should.not.exist(err);
                    originalData.should.equal(generatedData);

                    callback();
                  });
                });
              });

            }
          );
        },
        function clobstream2(callback) {
          connection.execute(
            "SELECT content FROM nodb_myclobs WHERE num = :n",
            { n: 1 },
            function(err, result) {
              should.not.exist(err);

              var clob = '';
              var lob = result.rows[0][0];
              should.exist(lob);
              lob.setEncoding('utf8'); // set the encoding so we get a 'string' not a 'buffer'

              lob.on('data', function(chunk) {
                clob += chunk;
              });

              lob.on('end', function() {
                fs.readFile(inFileName, { encoding: 'utf8' }, function(err, data) {
                  should.not.exist(err);
                  data.length.should.be.exactly(clob.length);
                  data.should.equal(clob);
                  callback();
                });
              });

              lob.on('error', function(err) {
                should.not.exist(err, "lob.on 'error' event");
              });
            }
          );
        },
        function objectOutFormat(callback) {
          connection.execute(
            "SELECT content FROM nodb_myclobs WHERE num = :n",
            { n: 1 },
            { outFormat: oracledb.OUT_FORMAT_OBJECT },
            function(err, result) {
              should.not.exist(err);

              var clob = '';
              var row = result.rows[0];
              var lob = row['CONTENT'];

              lob.setEncoding('utf8');

              lob.on('data', function(chunk) {
                clob = clob + chunk;
              });

              lob.on('end', function() {
                callback();
              });

              lob.on('error', function(err) {
                should.not.exist(err, "lob.on 'error' event");
              });
            }
          );
        },
        function deleteOutFile(callback) {
          fs.unlink(outFileName, function(err) {
            should.not.exist(err);
            callback();
          });
        }
      ], done);  // async

    }); // 40.1.1


    it('40.1.2 CLOB getData()', function(done) {
      connection.should.be.ok();
      async.series([
        function clobinsert1(callback) {

          connection.execute(
            "INSERT INTO nodb_myclobs (num, content) VALUES (:n, EMPTY_CLOB()) RETURNING content INTO :lobbv",
            { n: 2, lobbv: {type: oracledb.CLOB, dir: oracledb.BIND_OUT} },
            { autoCommit: false },  // a transaction needs to span the INSERT and pipe()
            function(err, result) {
              should.not.exist(err);
              (result.rowsAffected).should.be.exactly(1);
              (result.outBinds.lobbv.length).should.be.exactly(1);

              var inStream = fs.createReadStream(inFileName);
              var lob = result.outBinds.lobbv[0];

              lob.on('error', function(err) {
                should.not.exist(err, "lob.on 'error' event");
              });

              inStream.on('error', function(err) {
                should.not.exist(err, "inStream.on 'error' event");
              });

              lob.on('finish', function() {
                // now commit updates
                connection.commit(function(err) {
                  should.not.exist(err);
                  callback();
                });
              });

              inStream.pipe(lob); // copies the text to the CLOB
            }
          );
        },
        function clobgetval(callback) {
          connection.execute(
            "SELECT content FROM nodb_myclobs WHERE num = :n",
            { n: 2 },
            function(err, result) {
              should.not.exist(err);

              var lob = result.rows[0][0];
              should.exist(lob);

              fs.readFile(inFileName, { encoding: 'utf8' }, function(err, data) {
                should.not.exist(err);
                lob.getData(function(err, clob) {
                  should.not.exist(err);
                  data.length.should.be.exactly(clob.length);
                  data.should.equal(clob);
                  callback();
                });
              });
            });
        }
      ], done);  // async

    }); // 40.1.2

  }); // 40.1

  describe('40.2 stores null value correctly', function() {
    it('40.2.1 testing Null, Empty string and Undefined', function(done) {
      assist.verifyNullValues(connection, tableName, done);
    });
  });

});
