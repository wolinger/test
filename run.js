((async (fastMode /** 快速模式：以时间降序查询物品，若超过3页都没有能添加的物品，则认为该分类已经没有新增的 */) => {

    const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    /**
     * 获取物品
     * 
     * @returns [next,[uid]]
     */
    const getItemsApi = async (cookies, next, url_base) => {
        //const response = await fetch(`&cursor=${next}`, {
        const response = await fetch(`${url_base}&cursor=${next}`, {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "cookie": cookies
            },
            "method": "GET",
        })
        let data = await response.json()
        let nextPage = data.cursors?.next ?? null
        let uidList = data.results?.map(result => result.uid) ?? []
        //console.log(data.cursors.previous)
        //console.log(`测试物品数据: ${JSON.stringify(data)}`)
        return [nextPage, uidList]
    }

    /**
     * 添加到库
     */
    const addLibApi = async (cookies, token, uid, offerId) => {
        const response = await fetch(`https://www.fab.com/i/listings/${uid}/add-to-library`, {
            "headers": {
                "Cookies": cookies,
                "accept": "application/json, text/plain, */*",
                "accept-language": "en",
                "content-type": "multipart/form-data; boundary=----WebKitFormBoundary1",
                "priority": "u=1, i",
                "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-csrftoken": token,
                "x-requested-with": "XMLHttpRequest"
            },
            "referrer": `https://www.fab.com/zh-cn/listings/${uid}`,
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": `------WebKitFormBoundary1\r\nContent-Disposition: form-data; name=\"offer_id\"\r\n\r\n${offerId}\r\n------WebKitFormBoundary1--\r\n`,
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        });
        return response.status == 204
    }

    /**
     * 获取详细信息，主要要取得offerId
     */
    const listingsApi = async (cookies, token, uid) => {
        const response = await fetch(`https://www.fab.com/i/listings/${uid}`, {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "cookie": cookies,
                "referer": "https://www.fab.com/",
                "x-csrftoken": token
            },
            "method": "GET",
        })
        let data = await response.json()
        let title = data.title
        let offerId = null
        let type = null
        //尽量专业版
        if (data.licenses)
            for (licenseInfo of data.licenses) {
                if (licenseInfo.priceTier.price == 0.0) {
                    offerId = licenseInfo.offerId
                    type = licenseInfo.slug
                    if (licenseInfo.slug == "professional") {
                        break
                    }
                }
            }
        //console.log(`测试数据: ${JSON.stringify(data)}`)
        return [offerId, type, title]
    }


    /**
     * 获取许可状态
     */
    const listingsStateApi = async (cookies, token, uids) => {
        if (!Array.isArray(uids) || !uids.length)
            return {}
        let uidParams = uids.map(uid => `listing_ids=${uid}`).join("&")
        const response = await fetch(`https://www.fab.com/i/users/me/listings-states?${uidParams}`, {
            "headers": {
                "cookie": cookies,
                "accept": "application/json, text/plain, */*",
                "x-csrftoken": token,
                "x-requested-with": "XMLHttpRequest"
            },
            "referrer": "https://www.fab.com/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors",
            "credentials": "include"
        })
        let data = await response.json()
        return data.reduce((acc, item) => {
            acc[item.uid] = item.acquired;
            return acc;
        }, {})
    }

    console.log("⭐ UnrealFabAssistant: Automatically add all free resources from Fab to your account")
    console.log("⭐ Powered by https://github.com/RyensX/UnrealFabAssistant")

    // 获取cookies和xtoken
    console.log("-> Checking User Info...")
    let csrftoken = ""
    let cookies = document.cookie
    try {
        csrftoken = getCookie("fab_csrftoken") ?? "{}"
        if (!csrftoken) {
            return console.error("-> Error: cannot find csrftoken. Please login again.")
        }
    } catch (_) {
        return console.error("-> Error: cannot find csrftoken. Please login again.")
    }
    console.log(`cookies=${cookies}`)
    console.log(`csrftoken=${csrftoken}`)

    console.log("-> Start Process Items...")
    let totalCount = 0
    const MAX_EMPTY_PAGE = 3
    let countMap = {}

    let urls = {
        "UE": "https://www.fab.com/i/listings/search?channels=unreal-engine&is_free=1&sort_by=-createdAt",
        "Unity": "https://www.fab.com/i/listings/search?channels=unity&is_free=1&sort_by=-createdAt",
        "UEFN": "https://www.fab.com/i/listings/search?channels=uefn&is_free=1&sort_by=-createdAt",
        "Quixel": "https://www.fab.com/i/listings/search?currency=USD&seller=Quixel&sort_by=listingTypeWeight",
        "Quixel2": "https://www.fab.com/i/listings/search?channels=quixel&is_free=1&sort_by=-createdAt"
        //这里如果仅仅只需要其中一种类型资源，比如只需要UE的，那可以只保留UE的链接
    }
    const mainTasks = Object.entries(urls).map(async ([name, url]) => {
        console.log(`start by name=${name} url=${url}`)
        let nextPage = null
        let currentPageIndex = 1
        let currentCount = 0
        let lastPage = 0
        do {
            lastPage++
            const page = await getItemsApi(cookies, nextPage, url)
            console.log(`${name} page=${currentPageIndex++}(${page[0]}) ,count=${page[1].length}`)
            nextPage = page[0]
            //先获取许可状态
            const states = await listingsStateApi(cookies, csrftoken, page[1])
            //获取详情
            const tasks = page[1].map(async (uid) => {
                //已入库的不再重复。不过如果需要自动更新许可类型（尽量换成专业版）可以把这个限制去掉
                if (states[uid] == false) {
                    const info = await listingsApi(cookies, csrftoken, uid)
                    const [offerId, type, title] = info
                    if (offerId != null) {
                        console.log(`No.${currentCount} ${name} Item: name=${title} , offerId=${offerId}`)
                        //入库
                        const result = await addLibApi(cookies, csrftoken, uid, offerId)
                        console.log(`addLib No.${currentCount} ${title} from ${name} result=${result} page=${page[0]} type=${type}`)
                        if (result) {
                            lastPage = 0
                            currentCount++
                        }
                    }
                }
            })
            await Promise.allSettled(tasks)
            //break //测试用
        } while ((!fastMode || lastPage < MAX_EMPTY_PAGE) && nextPage != null && nextPage != "")
        console.log(`✅ ${name} done! ${currentCount} items added.`)
        totalCount += currentCount
        countMap[name] = currentCount
    })
    await Promise.allSettled(mainTasks)

    let countDetail = totalCount > 0 ?
        "(" + Object.entries(countMap).map(([key, value]) => `${key}:${value}`).join(" ") + ")"
        : ""
    console.log(`\n✅ All done! ${totalCount}${countDetail} items added.`)
})(console.fastMode ?? true))