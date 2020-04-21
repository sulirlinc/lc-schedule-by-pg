const { L, TimeUnit } = require("lc-js-common")
const dao = require('lc-pg-dao')
const moduleCode = 'lc.schedule'

const doCreateTable = ({ tableName, dao, fields }) => {
  return dao.createTable({
    isAutoCreateId: true,
    uniqueKeys: [ 'event', 'method' ],
    tableName,
    fields
  })
}

const fields = [ { name: 'event', type: 'VARCHAR(255)' },
  { name: 'method', type: 'VARCHAR(255)' },
  { name: 'triggerId', type: 'VARCHAR(255)' },
  { name: 'timeUnit', type: 'VARCHAR(255)' },
  { name: 'interval', type: 'INTEGER' },
  { name: 'status', type: 'INTEGER' },
];

const start = ({ dao, tableName, action, logger = { info: () => {} } }) => {
  dao.findByWhere({ tableName, data: { status: 1 } }).then(datas => {
    if (!datas) {
      return
    }
    datas.map(({ timeUnit, interval, triggerId, event, method }) => {
      const id = L.timer.putTrigger({ id: triggerId, timeUnit: TimeUnit[timeUnit], interval, trigger: () => action({ timeUnit, interval, triggerId, event, method }) })
      if (!triggerId) {
        dao.update({ tableName, primaryKeys: { event, method }, data: { triggerId: id } })
      }
      logger.info(`trigger:${ event }[${ method }],id:${ id } Startup complete.`)
    })
  })
}

const deleteTrigger = ({ dao, triggerId, tableName, logger, deleteOnPG }) => {
  if (triggerId) {
    L.timer.deleteTrigger({ id: triggerId })
    if (deleteOnPG) {
      dao.deleteData({ tableName, primaryKeys: { triggerId } }).catch(error => logger.error(error))
    }
    return true
  }
}

const LC_PG_DAO_DATA_IS_EXISTS = 'lc.pg.dao.data.is.exists';
module.exports = class LCSchedule {

  /**
   * 数据库初始化。
   * @param config
   * @returns dao
   */
  async initPGDAO({ config }) {
    this.dao = dao({ config })
    this.client = this.client || await this.dao.client()
    return this.dao
  }

  constructor(options = {}) {
    const { pgConfig, tableName = 'z_sys_schedule', logger = { info: () => {}, error: () => {} } } = options
    this.initStatus = { done: {}, error: {} }
    this.options = { ...options, tableName, logger };
    this.initPGDAO({ config: pgConfig }).then((dao) => {
      this.initStatus.done.pgDAO = true
      doCreateTable({
        tableName,
        dao, fields
      }).then(data => {
        logger.info(`done for create ${ tableName } table.`)
        logger.info(`data：${ data }`)
        this.initStatus.done.createTable = true
        start({ dao, tableName, action: this.trigger, logger });
      }).catch(error => {
        this.initStatus.error.createTableError = { error, code: `${ moduleCode }.create.table.error`, message: `创建表${ tableName }失败。`, info: { tableName, fields } };
        logger.error(error)
      })
    }).catch(error => {
      this.initStatus.error.initPGDAOError = { error, code: `${ moduleCode }.init.dao.error`, message: `初始数据库失败。`, info: { pgConfig } }
      logger.error(error)
    })
  }

  /**
   * 检查是否存在异常。
   */
  checkError() {
    const { logger = { info: () => {} } } = this.options
    for (const key in this.initStatus.error) {
      const data = this.initStatus.error[key]
      logger.info(data)
      throw data.error
    }
  }

  /**
   * 当前方法需要覆盖。
   * @param timeUnit
   * @param interval
   * @param triggerId
   * @param event
   * @param method
   */
  trigger({ timeUnit, interval, triggerId, event, method }) {

  }

  async findScheduleByPagination({ data }) {
    const { tableName } = this.options
    return this.dao.findByPagination({ tableName, data })
  }

  async addSchedule({ persistence = false, rightNow = true, event, method, triggerId, timeUnit, interval, status = 1 }) {
    this.do('persistence')({ persistence })
    const id = this.do('rightNow')({ rightNow, triggerId, timeUnit, interval, event, method, trigger: this.trigger })
    if (!triggerId) {
      triggerId = id
    }
    const { tableName } = this.options
    let insertData
    try {
      insertData = await this.dao.insertData({ tableName, primaryKeys: { event, method }, data: { triggerId, timeUnit, interval, event, method, status, createAt: L.now() } })
    } catch (e) {
      if (LC_PG_DAO_DATA_IS_EXISTS !== e.code) {
        throw e
      }
    }
    return {
      insertData,
      triggerId
    }
  }

  removeSchedule({ triggerId, method, event, deleteOnPG = false }) {
    const { tableName, logger } = this.options
    if (!deleteTrigger({ dao: this.dao, triggerId, tableName, logger, deleteOnPG }) && !L.isNullOrEmpty(method) && L.isNullOrEmpty(event)) {
      this.checkError()
      const { tableName, logger } = this.options
      this.dao.findByWhere({ tableName, data: { method, event } }).then((datas) => {
        if (!datas) {
          return
        }
        const { triggerId } = datas[0]
        if (deleteTrigger({ dao: this.dao, triggerId, tableName, logger, deleteOnPG })) {
          return
        }
        throw {
          error: new Error(),
          info: { triggerId, method, event },
          message: '未找到可删除的ID编号。',
          code: `${ moduleCode }.cannot.find.delete.id`,
        }
      }).catch(error => logger.error(error))
    }
  }

  do(key) {
    this.events = this.events || {
      persistence: ({ persistence }) => ({ true: this.checkError() }[persistence] || (() => {}))(),
      rightNow: ({
        rightNow, triggerId, timeUnit, interval, event, method, trigger
      }) => {
        return ({
          true: () => L.timer.putTrigger({
            id: triggerId,
            timeUnit: TimeUnit[timeUnit], interval, trigger: () => trigger({ triggerId, timeUnit, interval, event, method })
          })
        }[rightNow] || (() => {}))()
      }
    }
    return this.events[key] || (() => {})
  }
}
