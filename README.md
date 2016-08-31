## Pre-requisites

**Node.js**

Install Node.js v4 or above from https://nodejs.org/en/

**Artillery**

`npm install -g artillery@latest`

**Cloudflare**

- The IP of the machine that the tests run on may need to be whitelisted.
(It is possible to test the origin server (Apache) directly - see `rewriteHost` function in `functions.js`)

## Load-testing scripts

- `browse-only.yml` - simulate users that just browse the website and don't add anything to cart or try to check out
- `shop.yml` - simulate browsing *and* adding products to cart - with a degree of randomness (how many products are added to cart and what percentage of carts is abdandoned is configurable)

## Run the scripts

Each load-testing script defines three load-levels that it can be run with:

- "Test" - 240 users arriving to the website in 10 minutes (this is 25% of the projected load)
- "Light" - 480 users arriving in 10 minutes (50% of projected load)
- "Heavy" - 600 users arriving in 10 minutes
- "Soak" - 6000 users arriving in 1 hour (= projected SALE level of load)

Run a script with:

```
artillery run -e Test browse-shop-all-only.yml
```

where `Test` is the load-level from the list above.

This will print a bunch of stats to the terminal and create a JSON file with a name like `artillery_report_$timestamp.json`

The `json` report can be converted to a HTML report with:

```
artillery report jsonfile.json
```

## Contact

For any questions please contact Hassy Veldstra [<h@artillery.io>](mailto:h@artillery.io)
