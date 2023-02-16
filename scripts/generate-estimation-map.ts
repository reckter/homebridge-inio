import axios from 'axios';

import fs from 'fs';

type LampPowers = {
    cold: number,
    warm: number
}

type LampTemperature = {
    brightness: number,
    kelvin: number
}

async function getLampPower(): Promise<LampPowers> {
    let response = (await axios("http://192.168.161.151/api/app/pwm_duty_get")).data
    let settled = false
    while (!settled) {
        await sleep(10)
        const current = (await axios("http://192.168.161.151/api/app/pwm_duty_get")).data
        settled = current.cold === response.cold && current.warm === response.warm
        response = current

    }
    return response
}

async function setLampBrightness(to: LampTemperature): Promise<void> {
    await axios("http://192.168.161.151/api/app/light_color", {
        method: 'POST',
        data: to
    })
}

async function getPowerForBrightness(to: LampTemperature, sleepLong?: boolean): Promise<LampPowers> {
    await setLampBrightness(to)
    // await sleep(sleepLong? 2000 : 100)
    return await getLampPower()
}

async function loadResult(): Promise<Array<Item>> {
    const result: Array<Item> = JSON.parse(fs.readFileSync('data.json', "utf-8"))
    return result
}

async function loadResultPacked(): Promise<Array<Item>> {
    const packed: Array<Array<number>> = JSON.parse(fs.readFileSync('data-packed.json', "utf-8"))
    return packed.map(it => ({
        temperature: {
            brightness: it[0],
            kelvin: it[1]
        },
        power: {
            warm: it[2],
            cold: it[3]
        }
    }))
}

/**
 * Generates a raibow table of all possible brightness and kelvin combinations
 * saves a snapshot to data-packed.json every so often
 * Can continue from such a snapshot
 */
async function mapAll() {
    const result: Array<{ power: LampPowers, temperature: LampTemperature }> = await loadResultPacked()

    const seen = new Set<string>(
        result
            .map(it => it.temperature)
            .map(it => `${it.brightness},${it.kelvin}`)
    )

    for (let brightness = 0; brightness <= 100; brightness += 1) {
        for (let kelvin = 2700; kelvin <= 6500; kelvin += 10) {
            const temperature = {brightness, kelvin}
            const key = `${brightness},${kelvin}`
            if (seen.has(key)) continue

            const power = await getPowerForBrightness(temperature, kelvin == 2700)

            console.log(`${brightness},${kelvin} -> ${power.cold},${power.warm}`)

            result.push({power, temperature})
            seen.add(key)
        }
        void writeCompact(result)
    }
    await sleep(1000)
    await writeCompact(result)
    return result
}


function distance(a: LampPowers, b: LampPowers): number {
    const coldDistance = Math.abs(a.cold - b.cold)
    const warmDistance = Math.abs(a.warm - b.warm)
    return coldDistance * coldDistance + warmDistance * warmDistance
}

type Item = {
    power: LampPowers,
    temperature: LampTemperature
}

function getEstimate(power: LampPowers, map: Array<{ power: LampPowers, temperature: LampTemperature }>): Item {
    let best = map[0]
    let bestDistance = distance(power, best.power)

    map.forEach(it => {
        if(distance(it.power, power) < bestDistance) {
            best = it
            bestDistance = distance(it.power, power)
        }
    })

    return best
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Randomly sets a temprateru and brightness and compares the result to the estimate
 * @param result
 */
async function randomTest(result: Array<{ power: LampPowers, temperature: LampTemperature }>) {
    const brightness = Math.floor(Math.random() * 101)
    const kelvin = (Math.floor(Math.random() * (6500 - 2700)) + 2700)

    await setLampBrightness({brightness, kelvin})
    const power = await getLampPower()
    const estimate = getEstimate(power, result)
    const dist = Math.sqrt(distance(power, estimate.power))
    const distKelvin = estimate.temperature.kelvin - kelvin
    const distBrightness = estimate.temperature.brightness - brightness
    console.log(`set: ${brightness},${kelvin}, power: ${power.cold},${power.warm} \n\t-> power: ${estimate.power.cold}, ${estimate.power.warm} estimate: ${estimate.temperature.brightness},${estimate.temperature.kelvin} (${dist}; ${distBrightness}, ${distKelvin})`)
}

/**
 * runns randomTest 100 times
 */
async function test() {
    const result = await loadResultPacked()
    for (let i = 0; i < 100; i++) {
        await randomTest(result)
    }
}


async function writeCompact(result: Array<Item>){
    const packed = Object.values(result)
        .map(it => [it.temperature.brightness, it.temperature.kelvin, it.power.warm, it.power.cold] )
        .map(it => it.map(it => parseFloat(it.toFixed(5))))

    await fs.promises.writeFile('data-packed.json', JSON.stringify(packed))
}
/**
 * Compacts the
 */
async function dedupe() {
    console.log("loading data")
    const data = await loadResultPacked()

    console.log("deduping")
    const map: Record<string, Item> = {}

   data.forEach((it) => {
        map[`${it.temperature.brightness},${it.temperature.kelvin}`] =it
    })

    console.log("packing")
    const packed = Object.values(map)
        .map(it => [it.temperature.brightness, it.temperature.kelvin, it.power.warm, it.power.cold] )
        .map(it => it.map(it => parseFloat(it.toFixed(5))))

    console.log("saving")
    fs.writeFileSync('data-packed.json', JSON.stringify(packed))
}

mapAll().then(dedupe)