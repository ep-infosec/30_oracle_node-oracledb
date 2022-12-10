/* Copyright (c) 2022, Oracle and/or its affiliates. */

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
 *   266. aq4.js
 *
 * DESCRIPTION
 *   Test Oracle Advanced Queueing (AQ) - recipient list
 *
 *****************************************************************************/
'use strict';

const oracledb  = require('oracledb');
const dbconfig  = require('./dbconfig.js');
const testsUtil = require('./testsUtil.js');
const assert    = require('assert');

describe('267. aq4.js', function() {
  let conn           = null;

  const AQ_USER      = 'NODB_SCHEMA_AQTEST4';
  const AQ_USER_PWD  = testsUtil.generateRandomPassword();

  const objQueueName = "NODB_ADDR_QUEUE";
  const objType      = "NODB_ADDR_TYP";
  const objTable     = "NODB_TAB_ADDR";

  const addrData     = {
    NAME:    "scott",
    ADDRESS: "The kennel"
  };

  let addrDataArr = [
    {
      NAME: "scott",
      ADDRESS: "The kennel"
    },
    {
      NAME: "John",
      ADDRESS: "Pasadena"
    },
    {
      NAME: "Nick",
      ADDRESS: "London"
    }
  ];


  const plsqlCreateType = `
    CREATE OR REPLACE TYPE ${objType} AS OBJECT (
      NAME    VARCHAR2(10),
      ADDRESS VARCHAR2(50)
    );
  `;

  const plsqlCreateQueue = `
    BEGIN
      DBMS_AQADM.CREATE_QUEUE_TABLE(
        QUEUE_TABLE => '${AQ_USER}.${objTable}',
        multiple_consumers => TRUE,
        QUEUE_PAYLOAD_TYPE => '${objType}'
      );
      DBMS_AQADM.CREATE_QUEUE(
        QUEUE_NAME => '${AQ_USER}.${objQueueName}',
        QUEUE_TABLE => '${AQ_USER}.${objTable}'
      );
      DBMS_AQADM.START_QUEUE(
        QUEUE_NAME => '${AQ_USER}.${objQueueName}'
      );
    END;
  `;

  before(async function() {
    if (!dbconfig.test.DBA_PRIVILEGE) {
      this.skip();
      return;
    }

    await testsUtil.createAQtestUser(AQ_USER, AQ_USER_PWD);

    const credential = {
      user:          AQ_USER,
      password:      AQ_USER_PWD,
      connectString: dbconfig.connectString
    };
    conn = await oracledb.getConnection(credential);

    await conn.execute(plsqlCreateType);
    await conn.execute(plsqlCreateQueue);
  });  // before


  after(async function() {
    if (!dbconfig.test.DBA_PRIVILEGE)
      return;

    if (conn)
      await conn.close();

    await testsUtil.dropAQtestUser(AQ_USER);
  });  // after

  it('267.1 empty array or no recipients', async () => {
    try {
      // Enqueue
      const queue1 = await conn.getQueue(
        objQueueName,
        {payloadType: objType}
      );
      const message = new queue1.payloadTypeClass(addrData);
      await queue1.enqOne({
        payload: message,
        recipients: []
      });
      await conn.commit();

      //Dequeue
      const queue2 = await conn.getQueue(
        objQueueName,
        { payloadType: objType }
      );
      Object.assign(
        queue2.deqOptions,
        { consumerName: "" }
      );

      const msg = await queue2.deqOne();
      assert.strictEqual(msg, null);
      await conn.commit();
    } catch (e) {
      assert.strictEqual(e.message.startsWith("ORA-24033:"), true);
    }
  });

  it('267.2 single element in array', async () => {
    // Enqueue
    const queue1 = await conn.getQueue(
      objQueueName,
      {payloadType: objType}
    );
    const message = new queue1.payloadTypeClass(addrData);
    await queue1.enqOne({
      payload: message,
      recipients: [ "sub1" ]
    });
    await conn.commit();

    //Dequeue
    const queue2 = await conn.getQueue(
      objQueueName,
      { payloadType: objType }
    );
    Object.assign(
      queue2.deqOptions,
      { consumerName: "sub1" }
    );

    const msg = await queue2.deqOne ();
    assert.strictEqual(msg.payload.NAME, "scott");
    await conn.commit();
  });


  it('267.3 Negative - numbers as recipients ', async () => {
    try {
      // Enqueue
      const queue1 = await conn.getQueue(
        objQueueName,
        {payloadType: objType}
      );
      const message = new queue1.payloadTypeClass(addrData);
      await queue1.enqOne({
        payload: message,
        recipients: [1, 3, 5]
      });
    } catch (e) {
      assert.strictEqual(e.message.startsWith("NJS-005:"), true);
    }
  });


  it('267.4 Negative - number, string, date as recipients ', async () => {
    try {
      // Enqueue
      const queue1 = await conn.getQueue(
        objQueueName,
        {payloadType: objType}
      );
      const message = new queue1.payloadTypeClass(addrData);
      await queue1.enqOne({
        payload: message,
        recipients: [1, "abc", new Date(2022, 5, 17)]
      });
    } catch (e) {
      assert.strictEqual(e.message.startsWith("NJS-005:"), true);
    }
  });

  it('267.5 Negative -  null value for recipient', async () => {
    try {
      // Enqueue
      const queue1 = await conn.getQueue(
        objQueueName,
        {payloadType: objType}
      );
      const message = new queue1.payloadTypeClass(addrData);
      await queue1.enqOne({
        payload: message,
        recipients: [ null ]
      });
    } catch (e) {
      assert.strictEqual(e.message.startsWith("NJS-005:"), true);
    }
  });


  it('267.6 Negative - undefined value for recipient', async () => {
    try {
      // Enqueue
      const queue1 = await conn.getQueue(
        objQueueName,
        {payloadType: objType}
      );
      const message = new queue1.payloadTypeClass(addrData);
      await queue1.enqOne({
        payload: message,
        recipients: [ undefined ]
      });
    } catch (e) {
      assert.strictEqual(e.message.startsWith("NJS-005:"), true);
    }
  });

  it('267.7 Negative - dequeue non-existent name', async () => {
    try {
      // Enqueue
      const queue1 = await conn.getQueue(
        objQueueName,
        {payloadType: objType}
      );
      const message = new queue1.payloadTypeClass(addrData);
      await queue1.enqOne({
        payload: message,
        recipients: [ "sub1", "sub2" ]
      });
    } catch (e) {
      assert.strictEqual(e.message.startsWith("NJS-005:"), true);
    }
  });


  it('267.8 empty recipient list with enqMany', async () => {
    let msgList = [];

    try {
      // Enqueue
      const queue1 = await conn.getQueue(objQueueName, {payloadType: objType});
      for (let i = 0; i < addrDataArr.length; i++) {
        let msg = new queue1.payloadTypeClass(addrDataArr[i]);
        msgList[i] = { payload: msg, recipients: [] };
      }
      queue1.enqMany(msgList);
    } catch (e) {
      assert.strictEqual(e.message.startsWith("ORA-25231:"), true);
    }
  });

  it('267.9 recipient list with enqMany', async () => {
    let msgList = [];

    // Enqueue
    const queue1 = await conn.getQueue(objQueueName, {payloadType: objType});
    for (let i = 0; i < addrDataArr.length; i++) {
      let msg = new queue1.payloadTypeClass(addrDataArr[i]);
      msgList[i] = { payload: msg, recipients: ["sub1", "sub2", "sub3"] };
    }
    queue1.enqMany(msgList);

    // Dequeue
    const queue2 = await conn.getQueue(objQueueName, {payloadType: objType});
    Object.assign(
      queue2.deqOptions,
      {
        consumerName: "sub1",
        navigation: oracledb.AQ_DEQ_NAV_FIRST_MSG,
        wait: oracledb.AQ_DEQ_NO_WAIT
      }
    );
    let msgs = await queue2.deqMany(5);
    assert.strictEqual(msgs.length, 4);
  });


  it('267.10 recipient list with enqMany non-existent in dequeue', async () => {
    let msgList = [];

    // Enqueue
    const queue1 = await conn.getQueue(objQueueName, {payloadType: objType});
    for (let i = 0; i < addrDataArr.length; i++) {
      let msg = new queue1.payloadTypeClass(addrDataArr[i]);
      msgList[i] = { payload: msg, recipients: ["sub1", "sub2", "sub3"] };
    }
    queue1.enqMany(msgList);

    // Dequeue
    const queue2 = await conn.getQueue(objQueueName, {payloadType: objType});
    Object.assign(
      queue2.deqOptions,
      {
        consumerName: "abc",
        navigation: oracledb.AQ_DEQ_NAV_FIRST_MSG,
        wait: oracledb.AQ_DEQ_NO_WAIT
      }
    );
    let msgs = await queue2.deqMany(5);
    assert.strictEqual(msgs.length, 0);
  });

  it('267.11 recipient list with enqMany invalid datatype in dequeue', async () => {
    let msgList = [];

    try {
      // Enqueue
      const queue1 = await conn.getQueue(objQueueName, {payloadType: objType});
      for (let i = 0; i < addrDataArr.length; i++) {
        let msg = new queue1.payloadTypeClass(addrDataArr[i]);
        msgList[i] = { payload: msg,
          recipients: [101, "sub2", new Date(2022, 5, 22)] };
      }
      queue1.enqMany(msgList);
    } catch (e) {
      assert.strictEqual(e.message.startsWith("NJS-004:"), true);
    }
  });

});
