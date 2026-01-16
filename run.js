((async (fastMode /** 快速模式：以时间降序查询物品，若超过3页都没有能添加的物品，则认为该分类已经没有新增的 */) => {

    const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    const getItemsApi = async (cookies, next, url_base) => {
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
        // escapar caracteres especiais só pro log
        const safeTitle = encodeURIComponent(title)
        return [offerId, type, title, safeTitle]
    }

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

    let csrftoken = ""
    let cookies = document.cookie
    try {
        csrftoken = getCookie("fab_csrftoken") ?? "{}"
        if (!csrftoken) return console.error("-> Error: cannot find csrftoken. Please login again.")
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
                //"UE": "https://www.fab.com/i/listings/search?channels=unreal-engine&is_free=1&sort_by=-createdAt",
        //"Unity": "https://www.fab.com/i/listings/search?channels=unity&is_free=1&sort_by=-createdAt",
        //"UEFN": "https://www.fab.com/i/listings/search?channels=uefn&is_free=1&sort_by=-createdAt",
        //"Quixel": "https://www.fab.com/i/listings/search?currency=USD&seller=Quixel&sort_by=listingTypeWeight",
        //"Quixel2": "https://www.fab.com/i/listings/search?channels=quixel&is_free=1&sort_by=-createdAt",
        //"3DModels": "https://www.fab.com/i/listings/search?product_types=3d&is_free=1&sort_by=firstPublishedAt",
        //"MaterialsTextures": "https://www.fab.com/i/listings/search?product_types=materials&is_free=1&sort_by=firstPublishedAt",
        //"SpritesFlipbooks": "https://www.fab.com/i/listings/search?product_types=sprites&is_free=1&sort_by=firstPublishedAt",
        //"Decals": "https://www.fab.com/i/listings/search?product_types=decals&is_free=1&sort_by=firstPublishedAt",
        //"Brushes": "https://www.fab.com/i/listings/search?product_types=brushes&is_free=1&sort_by=firstPublishedAt",
        //"HDRI": "https://www.fab.com/i/listings/search?product_types=hdri&is_free=1&sort_by=firstPublishedAt",
        //"Animations": "https://www.fab.com/i/listings/search?product_types=animations&is_free=1&sort_by=firstPublishedAt",
        //"Audio": "https://www.fab.com/i/listings/search?product_types=audio&is_free=1&sort_by=firstPublishedAt",
        //"VFX": "https://www.fab.com/i/listings/search?product_types=vfx&is_free=1&sort_by=firstPublishedAt",
        //"UI": "https://www.fab.com/i/listings/search?product_types=ui&is_free=1&sort_by=firstPublishedAt",
        //"GameSystems": "https://www.fab.com/i/listings/search?product_types=game-systems&is_free=1&sort_by=firstPublishedAt",
        //"GameTemplates": "https://www.fab.com/i/listings/search?product_types=game-templates&is_free=1&sort_by=firstPublishedAt",
        //"ToolsPlugins": "https://www.fab.com/i/listings/search?product_types=tools-plugins&is_free=1&sort_by=firstPublishedAt",
        //"TutorialsExamples": "https://www.fab.com/i/listings/search?product_types=tutorials&is_free=1&sort_by=firstPublishedAt"

        //Prices Lowest First
        //"3DModels": "https://www.fab.com/i/listings/search?product_types=3d&is_free=1&sort_by=price_asc",
        //"MaterialsTextures": "https://www.fab.com/i/listings/search?product_types=materials&is_free=1&sort_by=price_asc",
        //"SpritesFlipbooks": "https://www.fab.com/i/listings/search?product_types=sprites&is_free=1&sort_by=price_asc",
        //"Decals": "https://www.fab.com/i/listings/search?product_types=decals&is_free=1&sort_by=price_asc",
        //"Brushes": "https://www.fab.com/i/listings/search?product_types=brushes&is_free=1&sort_by=price_asc",
        //"HDRI": "https://www.fab.com/i/listings/search?product_types=hdri&is_free=1&sort_by=price_asc",
        //"Animations": "https://www.fab.com/i/listings/search?product_types=animations&is_free=1&sort_by=price_asc",
        //"Audio": "https://www.fab.com/i/listings/search?product_types=audio&is_free=1&sort_by=price_asc",
        //"VFX": "https://www.fab.com/i/listings/search?product_types=vfx&is_free=1&sort_by=price_asc",
        //"UI": "https://www.fab.com/i/listings/search?product_types=ui&is_free=1&sort_by=price_asc",
        //"GameSystems": "https://www.fab.com/i/listings/search?product_types=game-systems&is_free=1&sort_by=price_asc",
        //"GameTemplates": "https://www.fab.com/i/listings/search?product_types=game-templates&is_free=1&sort_by=price_asc",
        //"ToolsPlugins": "https://www.fab.com/i/listings/search?product_types=tools-plugins&is_free=1&sort_by=price_asc",
        //"TutorialsExamples": "https://www.fab.com/i/listings/search?product_types=tutorials&is_free=1&sort_by=price_asc"

        "3DModels": "https://www.fab.com/i/listings/search?product_types=3d&is_free=1&sort_by=title_asc",
        "MaterialsTextures": "https://www.fab.com/i/listings/search?product_types=materials&is_free=1&sort_by=title_asc",
        "SpritesFlipbooks": "https://www.fab.com/i/listings/search?product_types=sprites&is_free=1&sort_by=title_asc",
        "Decals": "https://www.fab.com/i/listings/search?product_types=decals&is_free=1&sort_by=title_asc",
        "Brushes": "https://www.fab.com/i/listings/search?product_types=brushes&is_free=1&sort_by=title_asc",
        "HDRI": "https://www.fab.com/i/listings/search?product_types=hdri&is_free=1&sort_by=title_asc",
        "Animations": "https://www.fab.com/i/listings/search?product_types=animations&is_free=1&sort_by=title_asc",
        "Audio": "https://www.fab.com/i/listings/search?product_types=audio&is_free=1&sort_by=title_asc",
        "VFX": "https://www.fab.com/i/listings/search?product_types=vfx&is_free=1&sort_by=title_asc",
        "UI": "https://www.fab.com/i/listings/search?product_types=ui&is_free=1&sort_by=title_asc",
        "GameSystems": "https://www.fab.com/i/listings/search?product_types=game-systems&is_free=1&sort_by=title_asc",
        "GameTemplates": "https://www.fab.com/i/listings/search?product_types=game-templates&is_free=1&sort_by=title_asc",
        "ToolsPlugins": "https://www.fab.com/i/listings/search?product_types=tools-plugins&is_free=1&sort_by=title_asc",
        "TutorialsExamples": "https://www.fab.com/i/listings/search?product_types=tutorials&is_free=1&sort_by=title_asc"
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
            const states = await listingsStateApi(cookies, csrftoken, page[1])
            const tasks = page[1].map(async (uid) => {
                if (states[uid] == false) {
                    const info = await listingsApi(cookies, csrftoken, uid)
                    const [offerId, type, title, safeTitle] = info
                    if (offerId != null) {
                        console.log(`No.${currentCount} ${name} Item: name=${safeTitle} , offerId=${offerId}`)
                        const result = await addLibApi(cookies, csrftoken, uid, offerId)
                        console.log(`addLib No.${currentCount} ${safeTitle} from ${name} result=${result} page=${page[0]} type=${type}`)
                        if (result) {
                            lastPage = 0
                            currentCount++
                        }
                    }
                }
            })
            await Promise.allSettled(tasks)
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
