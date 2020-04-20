# lc-schedule-by-pg
持久化工作计划：当前设计，主要是为了把schedule丟到数据库中，通过添加数据库来满足添加启用或者停用schedule。

#默认值
tableName:z_sys_schedule
persistence:true
status:1
## 使用方法


```javascript

const LCSchedule = require('lc-schedule-by-pg')
const logger = require('./logger')

const lcSchedule = new LCSchedule({ logger, pgConfig: {
                                                 "user": "postgres",
                                                 "password": "123123",
                                                 "host": "127.0.0.1",
                                                 "port": "5432",
                                                 "database": "test"
                                               } })
lcSchedule.addSchedule({ persistence:true, rightNow:true, event:"../services/myService", methodName:"deleteInfo",timeUnit:'days',interval:1 }).catch((e) => logger.error(e))

```

