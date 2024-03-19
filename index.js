const puppeteer = require("puppeteer")
const cheerio = require("cheerio")
const mongoose = require("mongoose")
const Listing = require('./model/Listing')

async function connectToMongoDb() {
    await mongoose.connect("mongodb+srv://shreyasbehl:0Ti7Xda47a07Glq8@cluster0.nrntggp.mongodb.net/")
    console.log("connected to mongo db")
}

async function scrapeListings(page) {
  await page.goto("https://delhi.craigslist.org/search/sof#search=1~thumb~0~0")

  await page.waitForSelector(
    "#search-results-page-1 > ol > li > div > div > div.title-blob > a > span"
  )

  const html = await page.content()
  const $ = cheerio.load(html)
  const listings = $(".result-info")
    .map((index, element) => {
      const titleElement = $(element).find(".title-blob > a")
      const timeElement = $(element).find(".meta > span:nth-child(1)")
      const hoodElement = $(element).find(".supertitle")

      const span = $(titleElement).find("span")
      const title = $(span).text()
      const url = $(titleElement).attr("href")
      const datePosted = new Date($(timeElement).attr("title"))
      const hood = $(hoodElement)
        .text()
        .trim()
        .replace("(", "")
        .replace(")", "")
      return { title, url, datePosted, hood }
    })
    .get()
  // when using .map() then we have to use .get(), (because by default it returns cheerio object)
  return listings
}

async function scrapeJobDescriptions(listings, page) {
  // forEach doesn't work well with puppeteer
  for (var i = 0; i < listings.length; i++) {
    await page.goto(listings[i].url)

    const html = await page.content()
    const $ = cheerio.load(html)

    const jobDescription = $("#postingbody").text()
    listings[i].jobDescription = jobDescription
    
    const compensation = $("div.attrgroup > div.attr:nth-child(1) > span.valu").text()
    listings[i].compensation = compensation

    const listingModel = new Listing(listings[i])
    await listingModel.save()

    // limiting scraping request rate
    await sleep(1000)
  }
  return listings
}

async function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function main() {
  await connectToMongoDb()
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  const listings = await scrapeListings(page)
  const listingsWithJobDescriptions = await scrapeJobDescriptions(
    listings,
    page
  )
  console.log(listingsWithJobDescriptions)
  browser.close()
}

main()
