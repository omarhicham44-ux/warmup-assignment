const fs = require("fs")
// small cleanup and helper functions added
// Helper functions (internal utilities)
function toSeconds(t){
    let parts = t.trim().toLowerCase().split(" ")
    let time = parts[0].split(":").map(Number)
    let h = time[0]
    let m = time[1]
    let s = time[2]

    if(parts[1] === "pm" && h !== 12) h += 12
    if(parts[1] === "am" && h === 12) h = 0

    return h*3600 + m*60 + s
}

function toHMS(sec){
    let h = Math.floor(sec/3600)
    let m = Math.floor((sec%3600)/60)
    let s = sec%60

    if(m<10) m = "0"+m
    if(s<10) s = "0"+s

    return h+":"+m+":"+s
}

function simpleToSec(t){
    let p = t.split(":").map(Number)
    return p[0]*3600 + p[1]*60 + p[2]
}

// Main assignment functions
function getShiftDuration(startTime,endTime){

    let start = toSeconds(startTime)
    let end = toSeconds(endTime)

    let diff = end-start

    if(diff<0) diff += 24*3600

    return toHMS(diff)
}

function getIdleTime(startTime,endTime){

    let start = toSeconds(startTime)
    let end = toSeconds(endTime)

    if(end<start) end += 24*3600

    let workStart = toSeconds("8:00:00 am")
    let workEnd = toSeconds("10:00:00 pm")

    let idle = 0

    if(start<workStart){
        idle += Math.min(workStart,end)-start
    }

    if(end>workEnd){
        idle += end-Math.max(workEnd,start)
    }

    return toHMS(idle)
}

function getActiveTime(shiftDuration,idleTime){

    let a = simpleToSec(shiftDuration)
    let b = simpleToSec(idleTime)

    return toHMS(a-b)
}

function metQuota(date,activeTime){

    let active = simpleToSec(activeTime)

    let start = new Date("2025-04-10")
    let end = new Date("2025-04-30")

    let d = new Date(date)

    let quota = 8*3600 + 24*60

    if(d>=start && d<=end) quota = 6*3600

    return active>=quota
}

function addShiftRecord(textFile,shiftObj){

    let lines = []

    if(fs.existsSync(textFile)){
        lines = fs.readFileSync(textFile,"utf8").trim().split("\n")
    }

    for(let i=0;i<lines.length;i++){
        let p = lines[i].split(",").map(x=>x.trim())
        if(p[0]===shiftObj.driverID && p[2]===shiftObj.date){
            return {}
        }
    }

    let shiftDuration = getShiftDuration(shiftObj.startTime,shiftObj.endTime)
    let idleTime = getIdleTime(shiftObj.startTime,shiftObj.endTime)
    let activeTime = getActiveTime(shiftDuration,idleTime)
    let met = metQuota(shiftObj.date,activeTime)

    let newLine = shiftObj.driverID+", "+shiftObj.driverName+", "+shiftObj.date+", "+
    shiftObj.startTime+", "+shiftObj.endTime+", "+shiftDuration+", "+
    idleTime+", "+activeTime+", "+met+", false"

    let index = -1

    for(let i=0;i<lines.length;i++){
        let id = lines[i].split(",")[0].trim()
        if(id===shiftObj.driverID) index=i
    }

    if(index>=0){
        lines.splice(index+1,0,newLine)
    }else{
        lines.push(newLine)
    }

    fs.writeFileSync(textFile,lines.join("\n"))

    return {
        driverID:shiftObj.driverID,
        driverName:shiftObj.driverName,
        date:shiftObj.date,
        startTime:shiftObj.startTime,
        endTime:shiftObj.endTime,
        shiftDuration:shiftDuration,
        idleTime:idleTime,
        activeTime:activeTime,
        metQuota:met,
        hasBonus:false
    }
}

function setBonus(textFile,driverID,date,newValue){

    let lines = fs.readFileSync(textFile,"utf8").trim().split("\n")

    for(let i=0;i<lines.length;i++){

        let p = lines[i].split(",").map(x=>x.trim())

        if(p[0]===driverID && p[2]===date){
            p[9]=newValue
            lines[i]=p.join(", ")
        }
    }

    fs.writeFileSync(textFile,lines.join("\n"))
}

function countBonusPerMonth(textFile,driverID,month){

    let lines = fs.readFileSync(textFile,"utf8").trim().split("\n")

    let found=false
    let count=0

    for(let i=0;i<lines.length;i++){

        let p = lines[i].split(",").map(x=>x.trim())

        if(p[0]===driverID){

            found=true

            let m = parseInt(p[2].split("-")[1])

            if(m===parseInt(month) && p[9]==="true"){
                count++
            }
        }
    }

    if(!found) return -1

    return count
}

function getTotalActiveHoursPerMonth(textFile,driverID,month){

    let lines = fs.readFileSync(textFile,"utf8").trim().split("\n")

    let total=0

    for(let i=0;i<lines.length;i++){

        let p = lines[i].split(",").map(x=>x.trim())

        if(p[0]===driverID){

            let m = parseInt(p[2].split("-")[1])

            if(m===parseInt(month)){
                total += simpleToSec(p[7])
            }
        }
    }

    return toHMS(total)
}

function getRequiredHoursPerMonth(textFile,rateFile,bonusCount,driverID,month){

    let lines = fs.readFileSync(textFile,"utf8").trim().split("\n")
    let rates = fs.readFileSync(rateFile,"utf8").trim().split("\n")

    let dayOff=""

    for(let i=0;i<rates.length;i++){
        let p=rates[i].split(",").map(x=>x.trim())
        if(p[0]===driverID){
            dayOff=p[1]
        }
    }

    let total=0

    for(let i=0;i<lines.length;i++){

        let p=lines[i].split(",").map(x=>x.trim())

        if(p[0]!==driverID) continue

        let date=p[2]
        let m=parseInt(date.split("-")[1])

        if(m!==parseInt(month)) continue

        let d=new Date(date)

        let day=d.toLocaleDateString("en-US",{weekday:"long"})

        if(day===dayOff) continue

        let start=new Date("2025-04-10")
        let end=new Date("2025-04-30")

        if(d>=start && d<=end){
            total+=6*3600
        }else{
            total+=8*3600+24*60
        }
    }

    total-=bonusCount*2*3600

    return toHMS(total)
}

function getNetPay(driverID,actualHours,requiredHours,rateFile){

    let rates=fs.readFileSync(rateFile,"utf8").trim().split("\n")

    let base=0
    let tier=0

    for(let i=0;i<rates.length;i++){

        let p=rates[i].split(",").map(x=>x.trim())

        if(p[0]===driverID){
            base=parseInt(p[2])
            tier=parseInt(p[3])
        }
    }

    let allowed=[0,50,20,10,3]

    let actual=simpleToSec(actualHours)
    let required=simpleToSec(requiredHours)

    if(actual>=required) return base

    let miss=(required-actual)/3600

    let extra=Math.floor(miss-allowed[tier])

    if(extra<0) extra=0

    let rate=Math.floor(base/185)

    return base-(extra*rate)
}

module.exports={
getShiftDuration,
getIdleTime,
getActiveTime,
metQuota,
addShiftRecord,
setBonus,
countBonusPerMonth,
getTotalActiveHoursPerMonth,
getRequiredHoursPerMonth,
getNetPay
}