# lc-schedule-by-pg
持久化工作计划：当前设计，主要是为了把schedule丟到数据库中，通过添加数据库来满足添加启用或者停用schedule。

#默认值
* `tableName`: z_sys_schedule
* `persistence`: true
* `status`: 1 [1为启用，0为停用]

## 使用方法
schedule.js
```javascript

const LCSchedule = require('lc-schedule-by-pg')
const { pgConfig } = require("./config")
const logger = require('./logger')

LCSchedule.prototype.trigger = ({ event, method }) => {
  const fun = require(`./${ event }`);
  if (fun instanceof Function) {
    fun()[method]()
  } else if (fun[method] instanceof Function) {
    fun[method]()
  }
}

module.exports = new LCSchedule({ pgConfig, logger })

```

cachings.js

```javascript

module.exports = { 
  remove(){ 
  //Do your remove biz. 
  }
}
```

初始化应用，app.js 添加

```javascript

const mySchedule = require('./schedule')

const interval = 1;
mySchedule.addSchedule({ persistence: true, event: "cachings", method: "remove", timeUnit: "minutes", interval }).then(
    ({ triggerId }) => console.log(`启动内存定时每${ interval }分钟清理机制，triggerId:${ triggerId }。`)).catch(e => logger.error(e))


```
