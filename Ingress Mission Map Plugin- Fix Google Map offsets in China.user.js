// ==UserScript==
// @id             ingress-mission-map-plugin-fix-googlemap-china-offset@cother
// @name           Ingress Mission Map Plugin: Fix Google Map offsets in China
// @version        0.1.20160728.2333
// @namespace      https://github.com/ihamsterball/ingress-mission-map-plugin-fix-googlemap-china-offset
// @downloadURL    https://github.com/iHamsterball/ingress-mission-map-plugin-fix-googlemap-china-offset/raw/master/Ingress%20Mission%20Map%20Plugin-%20Fix%20Google%20Map%20offsets%20in%20China.user.js
// @description    Show correct Google Map for China user by applying offset tweaks.
// @author         Cother
// @include        http://ingressmm.com/*
// @include        https://ingressmm.com/*
// @match          http://ingressmm.com/*
// @match          https://ingressmm.com/*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
    // ensure plugin framework is there, even if iitc is not yet loaded
    if (typeof window.plugin !== 'function') window.plugin = function () { };

    // PLUGIN START

    // use own namespace for plugin
    window.plugin.fixChinaOffset = {};
    // 要理解此插件的工作原理，首先需要先理解以下几点：
    //
    //   1.
    //     Ingress 所使用的坐标系统是 WGS-84。
    //     然而，由于政策原因，除卫星地图外，Google Map 在中国地图请求的坐标系统是 GCJ-02；
    //     因此，如果使用 GCJ-02 坐标系统来请求地图数据，就可以获取到正确的地图。
    //   2.
    //     目前为止没有算法能够准确实现 GCJ-02 坐标系统向 WGS-84 的转换，
    //     但是从 WGS-84 向 GCJ-02 的转换已经有较为准确的算法可以实现。
    //   3.
    //     当 Ingress Mission Map 从 Google Map 请求数据的时候，DensityMarker 看起来并不
    //     参与交互（例如：拖拽和缩放），所有地图交互操作均位于 imm.min.js 文件中的函数。
    //
    // 因此，此插件覆写了涉及到地图坐标请求的函数，当用户操作地图时，这些函数将会传递偏移后的坐标。
    // 从而使 Google Map 渲染正确的地图。
    //
    // Ingress 内的对象，例如 Portal 和任务起始点，也可以通过这样的坐标转换来修正其位置。
    // 在处理边界时，使用了一个由 GCJ-02 向 WGS-84 转换的算法，从而可以渲染完整地图。
    // 该 GCJ-02 向 WGS-84 转换算法精度为 1e-6，误差为1~2m。
    //
    // Google Hybrid 地图，由于卫星地图是 WGS-84 坐标系统，因此卫星地图本身就是正确的。
    // 而道路使用的 GCJ-02 坐标系统，如果进行偏移，那么卫星地图也会受到影响。
    // 故最终处理方法为不做处理，可以把地标关掉只用卫星地图。
    //
    // WGS-84 向 GCJ-02 坐标系统转换的算法来自于：
    // https://on4wp7.codeplex.com/SourceControl/changeset/view/21483#353936
    // 由于这是机密文件，所以并没有官方算法。
    //
    // GCJ-02 向 WGS-84 坐标系统转换的算法采用了二分的思路，因此相对于 WGS-84 向 GCJ-02 坐标
    // 系统转换算法而言很慢，然而没办法，三角函数没有什么准确转回的方式。
    //
    // 如果你有兴趣或想法来帮助完善该插件，欢迎联系 Cother <ihamsterball@gmail.com>
    //
    // 此插件参照了 IITC 的同功能插件，并使用了其坐标转换和代码注入的代码。
    // 感谢原作者的努力。
    //
    // Before understanding how this plugin works, you should know 4 points:
    //
    //   Point1.
    //     The coordinate system of Ingress is WGS-84.
    //     However, the tiles of Google maps (except satellite map) in China have
    //     offsets (base on GCJ-02 coordinate system) by China policy.
    //     That means, if you request map tiles by giving GCJ-02 position, you
    //     will get the correct map.
    //
    //   Point2.
    //     Currently there are no easy algorithm to transform from GCJ-02 to WGS-84,
    //     but we can easily transform data from WGS-84 to GCJ-02.
    //
    //   Point3.
    //     When using Google maps in Ingress Mission Map, DensityMarker seems doesn't
    //     take part in the interaction (for example, dragging, zooming)
    //
    // So, here is the internal of the plugin:
    //
    // The plugin overwrites behaviours of the functions which involved map coordinate
    // request, When users are dragging the map, these functions will pass offseted 
    // positions to Google Map APIs (WGS-84 to GCJ-02).
    // So Google Map APIs will render a correct map.
    //
    // The offset between Google maps and Ingress objects can also be fixed by applying
    // WGS-84 to GCJ-02 transformation on Ingress objects. With using a GCJ-02 to WGS-84
    // transformation, it is posible to render a complete map.
    // The GCJ-02 to WGS-84 transformation algorithm's accuracy is 1e-6, 1~2m on GPS.
    //
    // The algorithm of transforming WGS-84 to GCJ-02 comes from:
    // https://on4wp7.codeplex.com/SourceControl/changeset/view/21483#353936
    // There is no official algorithm because it is classified information.
    //
    // If you have interest or idea to solve the above problems, 
    // welcome to contact Cother <ihamsterball@gmail.com>
    // Hope we can improve the plugin together.
    //
    // This plugin is based on the similar IITC plugin, and uses its
    // code inject and coordinate convert algorithm.
    // Thanks for the author's great work.

    // begin WGS84 to GCJ-02 transformer
    var WGS84transformer = window.plugin.fixChinaOffset.WGS84transformer = function () { };
    // Krasovsky 1940
    //
    // a = 6378245.0, 1/f = 298.3
    // b = a * (1 - f)
    // ee = (a^2 - b^2) / a^2;
    WGS84transformer.prototype.a = 6378245.0;
    WGS84transformer.prototype.ee = 0.00669342162296594323;

    WGS84transformer.prototype.transform = function (wgLat, wgLng) {

        if (this.isOutOfChina(wgLat, wgLng))
            return { lat: wgLat, lng: wgLng };

        dLat = this.transformLat(wgLng - 105.0, wgLat - 35.0);
        dLng = this.transformLng(wgLng - 105.0, wgLat - 35.0);
        radLat = wgLat / 180.0 * Math.PI;
        magic = Math.sin(radLat);
        magic = 1 - this.ee * magic * magic;
        sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((this.a * (1 - this.ee)) / (magic * sqrtMagic) * Math.PI);
        dLng = (dLng * 180.0) / (this.a / sqrtMagic * Math.cos(radLat) * Math.PI);
        mgLat = wgLat + dLat;
        mgLng = wgLng + dLng;

        return { lat: mgLat, lng: mgLng };

    };

    WGS84transformer.prototype.isOutOfChina = function (lat, lng) {

        if (lng < 72.004 || lng > 137.8347) return true;
        if (lat < 0.8293 || lat > 55.8271) return true;

        return false;

    };

    WGS84transformer.prototype.transformLat = function (x, y) {

        var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;

        return ret;

    };

    WGS84transformer.prototype.transformLng = function (x, y) {

        var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;

        return ret;

    };
    // end WGS84 to GCJ-02 transformer

    var WGS84toGCJ02 = new WGS84transformer();

    // begin GCJ-02 to WGS84 transformer
    var GCJ02transformer = window.plugin.fixChinaOffset.GCJ02transformer = function () { };

    GCJ02transformer.prototype.transform = function (gcjLat, gcjLng) {
        // newCoord = oldCoord = gcjCoord
        var newLat = gcjLat, newLng = gcjLng;
        var oldLat = newLat, oldLng = newLng;
        var threshold = 1e-6; // ~0.55 m equator & latitude

        var flag = true;
        for (var i = 0; i < 30; i++) {
            // oldCoord = newCoord
            oldLat = newLat;
            oldLng = newLng;
            console.log(newLat, newLng);
            // newCoord = gcjCoord - wgs_to_gcj_delta(newCoord)
            var tmp = WGS84toGCJ02.transform(newLat, newLng);
            console.log(tmp.lat, tmp.lng);
            // approx difference using gcj-space difference
            newLat -= gcjLat - tmp.lat;
            newLng -= gcjLng - tmp.lng;
            // diffchk
            if (Math.max(Math.abs(oldLat - newLat), Math.abs(oldLng - newLng)) < threshold) {
                flag = false;
                break;
            }
        }
        if (flag) {
            for (i = 0; i < 30; i++) {
                // oldCoord = newCoord
                oldLat = newLat;
                oldLng = newLng;
                console.log(newLat, newLng);
                // newCoord = gcjCoord - wgs_to_gcj_delta(newCoord)
                var tmp2 = WGS84toGCJ02.transform(newLat, newLng);
                console.log(tmp2.lat, tmp2.lng);
                // approx difference using gcj-space difference
                newLat += gcjLat - tmp2.lat;
                newLng += gcjLng - tmp2.lng;
                // diffchk
                if (Math.max(Math.abs(oldLat - newLat), Math.abs(oldLng - newLng)) < threshold) {
                    break;
                }
            }
        }
        return { lat: newLat, lng: newLng };
    };
    // end GCJ-02 to WGS84 transformer

    var GCJ02toWGS84 = new GCJ02transformer();

    window.plugin.fixChinaOffset.WGS84toGCJ02 = function (lat, lng, type) {

        // No offsets in satellite and hybrid maps
        // Update by Cother: There DO have offsets in hybrid maps, but currently
        // there isn't a proper way to fix the roads without changing satellite.
        if (type !== 'satellite' && type !== 'hybrid') {
            //console.log('Roadmap');
            var newPos = WGS84toGCJ02.transform(lat, lng);
            return new google.maps.LatLng(newPos.lat, newPos.lng);
        } else {
            //console.log('Satellite or Hybrid');
            return new google.maps.LatLng(lat, lng);
        }

    };

    window.plugin.fixChinaOffset.GCJ02toWGS84 = function (lat, lng, type) {
        if (type !== 'satellite' && type !== 'hybrid') {
            //console.log('Roadmap');
            return GCJ02toWGS84.transform(lat, lng);
        } else {
            //console.log('Satellite or Hybrid');
            return { lat: lat, lng: lng };
        }
    };

    // overwrite set_portal function
    set_portal = function (mid, pid, focus) {
        var coordinates = [];
        for (var i in Mission[mid].portal) {
            if (typeof pid != "undefined" && i != pid)
                continue; var p = Mission[mid].portal[i];
            if (!p[0] && p.length >= 3) {
                // modified
                var latlng = window.plugin.fixChinaOffset.WGS84toGCJ02(p[2].latitude, p[2].longitude, Map.mapTypeId);

                // modified end
                var icon = new google.maps.MarkerImage("img/p" + ("00" + (parseInt(i) + 1)).substr(-2) + (focus ? "f" : "n") + ".png", new google.maps.Size(32, 32), new google.maps.Point(0, 0), new google.maps.Point(16, 16));
                if (p[2].marker)
                    p[2].marker.setMap(null);
                p[2].marker = new google.maps.Marker({
                    position: latlng,
                    title: p[2].name,
                    icon: icon
                });
                p[2].marker.setMap(Map);
                // modified
                coordinates.push(window.plugin.fixChinaOffset.WGS84toGCJ02(p[2].latitude, p[2].longitude, Map.mapTypeId));

                // modified end
            }
        }
        if (!pid && typeof Mission[mid].polyline == "undefined" && coordinates.length > 0) {
            Mission[mid].polyline = new google.maps.Polyline({
                path: coordinates,
                strokeColor: Mission[mid].sequence == 1 ? "#0040a0" : "#00c000",
                strokeOpacity: Mission[mid].sequence == 1 ? .5 : .4,
                strokeWeight: 8
            });
            Mission[mid].polyline.setMap(Map);
        }
    };
    // end overwrite set_portal function

    // overwrite toggle_mission function
    toggle_mission = function (id, move) {
        var e = $(".mission[mission=" + id + "]");
        if (e.hasClass("focus")) {
            e.removeClass("focus");
            inactivate_mission(id);
            if ($("#tab_view").hasClass("focus") && $(".mission.focus").length == 0 && is_center_move()) {
                update_mission();
                return;
            }
        } else {
            e.addClass("focus");
            $("#detail_info_name").text(Mission[id].name);
            $("#detail_info_intro").text(Mission[id].intro);
            $("#detail_info_icon_small").css("background-image", Mission[id].code ? "url(https://ingressmm.com/icon/" + Mission[id].code + ".jpg)" : "");
            $("#detail_area").removeClass("hide");
            // modified
            var latlng = window.plugin.fixChinaOffset.WGS84toGCJ02(Mission[id].latitude, Mission[id].longitude, Map.mapTypeId);

            // modified end
            if (move)
                Map.panTo(latlng);
            Mission[id].marker.setAnimation(google.maps.Animation.BOUNCE);
            if (typeof Mission[id].portal != "undefined")
                set_portal(id);
            else
                $.ajax("get_portal.php", {
                    data: {
                        mission: id
                    },
                    dataType: "JSON",
                    complete: function (rsl, stat, xhr) {
                        if (!rsl.responseJSON)
                            alert(rsl.responseText);
                        else {
                            var id = rsl.responseJSON.mission;
                            if (!$(".mission[mission=" + id + "]").hasClass("focus"))
                                return;
                            Mission[id].portal = rsl.responseJSON.portal;
                            set_portal(id);
                            var e = $(".mission[mission=" + id + "]").find(".mission_portal").eq(0);
                            for (var i in Mission[id].portal)
                                if (Mission[id].portal[i][0] || Mission[id].portal[i].length >= 3) {
                                    var name = Mission[id].portal[i][0] ? "Waypoint Hidden" : Mission[id].portal[i][2].name;
                                    var task = Mission[id].portal[i][0] ? "Complete objectives to unlock" : task_list[Mission[id].portal[i][1]];
                                    e = e.clone(true).attr("portal", i).insertAfter(e).show().find(".portal_name").html(Mission[id].portal[i][0] ? "<span class='portal_hidden'>" + name + "</span>" : name).attr("title", name).end().find(".portal_task").html(task).attr("title", task).end().find(".portal_marker").css("background-image", "url(img/p" + ("00" + (parseInt(i) + 1)).substr(-2) + "n.png)").end().find(".portal_marker.focus").css("background-image", "url(img/p" + ("00" + (parseInt(i) + 1)).substr(-2) + "f.png)").end();
                                    if (Mission[id].portal[i].length >= 3) {
                                        e.find(".portal_on_googlemap").attr("href", "https://maps.google.com/maps?ll=" + Mission[id].portal[i][2].latitude + "," + Mission[id].portal[i][2].longitude).end().find(".portal_on_intelmap").attr("href", "https://www.ingress.com/intel?ll=" + Mission[id].portal[i][2].latitude + "," + Mission[id].portal[i][2].longitude + "&pll=" + Mission[id].portal[i][2].latitude + "," + Mission[id].portal[i][2].longitude).end().find(".portal_direction").attr("href", "https://maps.google.com/maps?daddr=" + Mission[id].portal[i][2].latitude + "," + Mission[id].portal[i][2].longitude + "&saddr=").end();
                                    }
                                }
                        }
                    }
                });
        }
        $(".more_menu,.float_box").hide();
    };
    // end overwrite toggle_mission function

    // overwrite update_mission function
    update_mission = function (param, move) {
        if (typeof param == "string")
            param = {
                find: param,
                findby: $("#find_by").val()
            };
        if (typeof param == "undefined") {
            var center = Map.getCenter();
            var bounds = Map.getBounds();
            var ne = bounds.getNorthEast();
            var sw = bounds.getSouthWest();
            param = {
                center: window.plugin.fixChinaOffset.GCJ02toWGS84(center.lat(), center.lng(), Map.mapTypeId),
                bounds: {
                    ne: window.plugin.fixChinaOffset.GCJ02toWGS84(ne.lat(), ne.lng(), Map.mapTypeId),
                    sw: window.plugin.fixChinaOffset.GCJ02toWGS84(sw.lat(), sw.lng(), Map.mapTypeId)
                }
            };
            console.log(center, ne, sw);
            if ($("#tab_view").hasClass("focus"))
                update_map_link();
        }
        if (!(param.new > 0))
            clear_mission();
        param.rid = Math.floor(Math.random() * 1e5);
        if (googlePlus)
            param.googlePlus = googlePlus.id;
        $.ajax("get_mission.php", {
            data: param,
            dataType: "JSON",
            complete: function (rsl, stat, xhr) {
                if (!rsl.responseJSON)
                    alert(rsl.responseText);
                else {
                    var data = rsl.responseJSON, i;
                    if (param.rid != data.rid)
                        return;
                    for (i in data.count) {
                        var c = data.count[i];
                        var density = new DensityMarker(c.lat, c.lng, data.grid / 2 * (.5 + .5 * Math.min(1, c.count / 100)), c.count);
                        density.setMap(Map);
                    }
                    for (i in data.mission) {
                        if (data && data.bounds && (data.mission[i].latitude < data.bounds.sw.lat || data.mission[i].latitude > data.bounds.ne.lat || data.mission[i].longitude < data.bounds.sw.lng || data.mission[i].longitude > data.bounds.ne.lng))
                            continue; MissionIdx.push(data.mission[i].id);
                        Mission[data.mission[i].id] = data.mission[i];
                        if (lastNewMissionId == 0 || data.mission[i].id < lastNewMissionId)
                            lastNewMissionId = data.mission[i].id;
                    }
                    if (data.find)
                        MissionIdx.sort(function (a, b) {
                            return Mission[b].name < Mission[a].name ? 1 : -1;
                        });
                    else
                        MissionIdx.sort(function (a, b) {
                            return Mission[a].distance - Mission[b].distance + (Mission[a].index - Mission[b].index);
                        });
                    var count = 0;
                    if (param.find) {
                        var author = [];
                        for (var i in _author)
                            author.push(i);
                        author.sort();
                        $("#filter_author").empty();
                        $("<option>").appendTo($("#filter_author")).val("").text("all");
                        for (var i in author)
                            $("<option>").appendTo($("#filter_author")).text(author[i]);
                        update_find_custom();
                        check_medal_art();
                    }
                    var _author = {};
                    for (var i in MissionIdx) {
                        var id = MissionIdx[i];
                        if ($("#mission_list .mission[mission=" + id + "]").length > 0)
                            continue; Mission[id].visible = true;
                        if (param.find)
                            _author[Mission[id].author] = true;
                        // modified
                        var latlng = window.plugin.fixChinaOffset.WGS84toGCJ02(Mission[id].latitude, Mission[id].longitude, Map.mapTypeId);

                        // modified end
                        var icon = get_icon(Mission[id]);
                        if (!icon)
                            continue; Mission[id].marker = new google.maps.Marker({
                                position: latlng,
                                title: Mission[id].name,
                                icon: icon
                            });
                        Mission[id].marker.setMap(Map);
                        attach_mission_marker_click(id);
                        var m = $("#parts .mission").clone(true).attr({
                            mission: id,
                            mid: Mission[id].code
                        }).appendTo("#mission_list");
                        m.find(".mission_icon").css("background-image", "url(https://ingressmm.com/icon/" + Mission[id].code + ".jpg)");
                        m.find(".mission_name").text(Mission[id].name).attr("title", Mission[id].name);
                        m.find(".mission_author").text(Mission[id].author).attr({
                            title: Mission[id].author,
                            faction: Mission[id].faction
                        });
                        m.find(".mission_on_intelmap").attr("href", "https://www.ingress.com/mission/" + Mission[id].code);
                        m.find(".mission_on_googlemap").attr("href", "https://maps.google.com/maps?ll=" + latlng.lat() + "," + latlng.lng());
                        m.find(".mission_direction").attr("href", "https://maps.google.com/maps?daddr=" + latlng.lat() + "," + latlng.lng() + "&saddr=");
                        m.find(".find_by_author").attr("href", "?find=" + encodeURIComponent(Mission[id].author) + "&findby=1");
                        m.find(".mission_detail").text(Mission[id].intro);
                        update_mission_summary(Mission[id]);
                        count++;
                    }
                    resize_screen();
                    $("#mission_total_count").text(data.total);
                    if (typeof param.new != "undefined") {
                        var num = $("#mission_list .mission:visible").length;
                        $("#new_preview_count").text(num);
                        if (num < data.total)
                            $("#mission_list_end").addClass("more").removeClass("mission_list_loading");
                    }
                    if (move && count > 0)
                        if (data.find && count > 1) {
                            var sw, ne;
                            for (var i in Mission)
                                if (typeof sw == "undefined") {
                                    sw = {
                                        lat: Mission[i].latitude,
                                        lng: Mission[i].longitude
                                    };
                                    ne = {
                                        lat: Mission[i].latitude,
                                        lng: Mission[i].longitude
                                    };
                                } else {
                                    sw.lat = Math.min(sw.lat, Mission[i].latitude);
                                    sw.lng = Math.min(sw.lng, Mission[i].longitude);
                                    ne.lat = Math.max(ne.lat, Mission[i].latitude);
                                    ne.lng = Math.max(ne.lng, Mission[i].longitude);
                                }
                            if (typeof sw != "undefined") {
                                // modified
                                var ll_sw = window.plugin.fixChinaOffset.WGS84toGCJ02(sw.lat, sw.lng, Map.mapTypeId);
                                var ll_ne = window.plugin.fixChinaOffset.WGS84toGCJ02(ne.lat, ne.lng, Map.mapTypeId);

                                // modified end
                                bounds = new google.maps.LatLngBounds(ll_sw, ll_ne);
                                Map.panToBounds(bounds);
                                Map.fitBounds(bounds);
                            }
                        } else {
                            // modified
                            var latlng = window.plugin.fixChinaOffset.WGS84toGCJ02(Mission[MissionIdx[0]].latitude, Mission[MissionIdx[0]].longitude, Map.mapTypeId);

                            // modified end
                            Map.panTo(latlng);
                        }
                }
            }
        });
    };
    // end overwrite update_mission function

    // overwrite update_map_link function
    update_map_link = function () {
        var center = Map.getCenter();
        var zoom = Map.getZoom();
        var center_fix = window.plugin.fixChinaOffset.GCJ02toWGS84(center.lat(), center.lng());
        set_link("/?pos=" + center_fix.lat + "," + center_fix.lng + "&zoom=" + zoom);
        $(".jump_intelmap_current").attr("href", "https://www.ingress.com/intel?ll=" + center_fix.lat + "," + center_fix.lng + "&z=" + zoom);
        $(".jump_googlemap_current").attr("href", "https://maps.google.com/maps?ll=" + center_fix.lat + "," + center_fix.lng + "&z=" + zoom);
    };
    // end overwrite update_map_link function
    // seems that this function is not used

    // overwrite move_current_pos function
    move_current_pos = function (pos) {
        console.log('Overwrited function is running...');
        var d = $.Deferred();
        if (pos && typeof pos.coords != "undefined") {
            $(".mission_direction,.portal_direction").show();
            d.resolve();
        } else
            navigator.geolocation.getCurrentPosition(function (_pos) {
                pos = _pos;
                d.resolve();
                // modified
                var latlng = window.plugin.fixChinaOffset.WGS84toGCJ02(pos.coords.latitude, pos.coords.longitude, Map.mapTypeId);

                // modified end
                Map.panTo(latlng);
            }, function (err) {
                d.reject();
            }, {
                    enableHighAccuracy: true,
                    timeout: 2e3
                });
        d.done(function () {
            // modified
            var latlng = window.plugin.fixChinaOffset.WGS84toGCJ02(pos.coords.latitude, pos.coords.longitude, Map.mapTypeId);

            // modified end
            if (!currentPosMarker) {
                var icon = {
                    path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                    fillColor: "#0c0",
                    fillOpacity: 1,
                    scale: 6,
                    strokeColor: "#080",
                    strokeWeight: 2
                };
                currentPosMarker = new google.maps.Marker({
                    position: latlng,
                    icon: icon
                });
                currentPosMarker.setMap(Map);
            }
            currentPosMarker.setPosition(latlng);
        });
    };
    // end overwrited move_current_pos function

    // overwrite mission portal click function
    $(".mission_portal").click(function (e) {
        console.log("Overwrited");
        var e = $(e.currentTarget);
        var pid = e.attr("portal");
        var mid = e.parents(".mission").first().attr("mission");
        inactivate_portal();
        e.addClass("focus");
        if (Mission[mid].portal[pid].length >= 3) {
            var latlng_fix = window.plugin.fixChinaOffset.WGS84toGCJ02(Mission[mid].portal[pid][2].latitude, Mission[mid].portal[pid][2].longitude, Map.mapTypeId);
            console.log("Unfixed", Mission[mid].portal[pid][2].latitude, Mission[mid].portal[pid][2].longitude);
            console.log("Fixed", latlng_fix.lat(), latlng_fix.lng());
            //var latlng = new google.maps.LatLng(Mission[mid].portal[pid][2].latitude, Mission[mid].portal[pid][2].longitude);
            //console.log("Unfixed", latlng.lat(), latlng.lng());
            Map.panTo(latlng_fix);
            set_portal(mid, pid, true);
        }
        $(".more_menu,.float_box").hide();
        return false;
    });
    // end overwrite mission portal click function

    // PLUGIN END
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(info) + ');'));
(document.body || document.head || document.documentElement).appendChild(script);
