(async () => {
  const { createApp } = Vue;
  const storageKey = "wechain-checkin-v1";
  const weekNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const modeOrder = ["none", "done", "missing", "all"];
  const collator = new Intl.Collator("zh-Hans-u-co-pinyin", { numeric: true, sensitivity: "base" });
  const templates = await loadTemplates();

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function unique(values) {
    return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
  }

  async function loadTemplates() {
    try {
      const response = await fetch("./data/templates.json", { cache: "no-cache" });
      return await response.json();
    } catch (error) {
      return {
        singleDone: ["{date}\n\n{names}\n{count}人已完成接龙 🎉"],
        singleMissing: { common: ["{date}\n\n{names}\n还有{count}人未完成接龙。"] },
        rangeDone: ["{range}\n\n{names}\n{count}人完成全部接龙。"],
        rangeMissing: ["{range}\n\n{names}\n{count}人存在未完成记录。"],
        weekDone: ["{range}\n\n{names}\n{count}人完成了一周全部接龙 🎉"],
        all: ["{range}\n\n已完成：{doneCount}人\n{doneNames}\n\n未完成：{missCount}人\n{missNames}"],
        emptyDone: ["{date}\n\n暂时还没有人完成接龙。"],
        emptyMissing: ["{date}\n\n今天没有未完成名单，全员到齐 🎉"]
      };
    }
  }

  function createDefaultStore() {
    const listId = makeId("list");
    return {
      version: 1,
      activeListId: listId,
      lists: [
        {
          id: listId,
          name: "健身群",
          members: [
            { id: makeId("member"), name: "小羊", deleted: false },
            { id: makeId("member"), name: "风里跑", deleted: false },
            { id: makeId("member"), name: "阿宁今天练腿", deleted: false }
          ],
          marks: {},
          dateModes: {}
        }
      ]
    };
  }

  function readStore() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : createDefaultStore();
    } catch (error) {
      return createDefaultStore();
    }
  }

  createApp({
    data() {
      return {
        store: readStore(),
        templates,
        modal: "",
        pasteDate: "",
        pasteText: "",
        pendingNames: [],
        selectedPendingNames: [],
        memberText: "",
        listNameDraft: "",
        timeOverride: "auto",
        noticeSeed: 0,
        noticeSpark: false,
        swipeStart: null,
        todayKey: dateKey(new Date())
      };
    },

    computed: {
      activeList() {
        return this.store.lists.find((list) => list.id === this.store.activeListId) || this.store.lists[0];
      },

      activeMembers() {
        return this.activeList.members.filter((member) => !member.deleted);
      },

      dateModes() {
        return this.activeList.dateModes;
      },

      visibleDates() {
        const today = new Date();
        const start = addDays(today, -31);
        return Array.from({ length: 63 }, (_, index) => {
          const date = addDays(start, index);
          return {
            key: dateKey(date),
            label: `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
            weekday: weekNames[date.getDay()]
          };
        });
      },

      groupedMembers() {
        const groups = new Map();
        const normal = this.activeList.members.filter((member) => !member.deleted);
        const deleted = this.activeList.members.filter((member) => member.deleted);

        normal.sort((a, b) => collator.compare(a.name, b.name));
        deleted.sort((a, b) => collator.compare(a.name, b.name));

        normal.forEach((member) => {
          const key = getInitialGroup(member.name);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(member);
        });

        const sortedKeys = [...groups.keys()].sort((a, b) => {
          if (a === "#") return 1;
          if (b === "#") return -1;
          return a.localeCompare(b);
        });

        const result = sortedKeys.map((key) => ({
          key,
          title: `---${key}(${groups.get(key).length})---`,
          members: groups.get(key)
        }));

        if (deleted.length) {
          result.push({ key: "deleted", title: `---删除(${deleted.length})---`, members: deleted });
        }

        return result;
      },

      selectedDates() {
        return this.visibleDates.filter((date) => this.getDateMode(date.key) !== "none");
      },

      noticeData() {
        return buildNoticeData(this.activeMembers, this.activeList.marks, this.selectedDates, this.dateModes);
      },

      noticeMeta() {
        if (!this.selectedDates.length) return "点日期第三行符号选择统计范围";
        const modes = unique(this.selectedDates.map((date) => this.modeSymbol(this.getDateMode(date.key))));
        return `${this.noticeData.rangeLabel} · ${modes.join(" ")}`;
      },

      noticeText() {
        return renderNotice(this.noticeData, this.templates, this.currentTimeSlot, this.noticeSeed);
      },

      currentNamesLine() {
        return this.noticeData.primaryNames.map((name) => `@${name}`).join(" ");
      },

      currentTimeSlot() {
        return this.timeOverride === "auto" ? getTimeSlot(new Date()) : this.timeOverride;
      },

      csvText() {
        const dates = this.visibleDates.map((date) => date.key);
        const rows = [["name", ...dates]];
        this.activeMembers.forEach((member) => {
          rows.push([member.name, ...dates.map((key) => (this.isDone(member.id, key) ? "1" : "0"))]);
        });
        return rows.map((row) => row.map(csvCell).join(",")).join("\n");
      },

      modalTitle() {
        return {
          paste: "粘贴接龙",
          members: "新增人员",
          lists: "管理列表",
          csv: "CSV 数据"
        }[this.modal] || "";
      }
    },

    watch: {
      store: {
        deep: true,
        handler(value) {
          localStorage.setItem(storageKey, JSON.stringify(value));
        }
      }
    },

    mounted() {
      requestAnimationFrame(() => {
        const wrap = document.querySelector(".matrix-wrap");
        const todayHead = document.querySelector(".date-head.today");
        if (wrap && todayHead) {
          wrap.scrollLeft = Math.max(0, todayHead.offsetLeft - wrap.clientWidth / 2 + todayHead.clientWidth / 2);
        }
      });
    },

    methods: {
      getDateMode(key) {
        return this.dateModes[key] || "none";
      },

      modeSymbol(mode) {
        return { none: "○", done: "✓", missing: "-", all: "◎" }[mode] || "○";
      },

      cycleDateMode(key) {
        const current = this.getDateMode(key);
        const next = modeOrder[(modeOrder.indexOf(current) + 1) % modeOrder.length];
        if (next === "none") delete this.dateModes[key];
        else this.dateModes[key] = next;
        this.randomizeNotice();
      },

      isDone(memberId, key) {
        return Boolean(this.activeList.marks[key]?.[memberId]);
      },

      toggleMark(memberId, key) {
        this.ensureDate(key);
        this.activeList.marks[key][memberId] = !this.activeList.marks[key][memberId];
        this.randomizeNotice();
      },

      ensureDate(key) {
        if (!this.activeList.marks[key]) this.activeList.marks[key] = {};
      },

      openPaste(key) {
        this.pasteDate = key;
        this.pasteText = "";
        this.pendingNames = [];
        this.selectedPendingNames = [];
        this.modal = "paste";
      },

      openPasteForToday() {
        this.openPaste(this.todayKey);
      },

      previewPaste() {
        const names = parseCheckinText(this.pasteText);
        const known = new Set(this.activeList.members.map((member) => member.name));
        this.pendingNames = names.filter((name) => !known.has(name));
        this.selectedPendingNames = [...this.pendingNames];
        return names;
      },

      applyPaste() {
        const names = this.previewPaste();
        this.addMembers(this.selectedPendingNames);
        const memberByName = new Map(this.activeList.members.map((member) => [member.name, member]));
        this.ensureDate(this.pasteDate);
        names.forEach((name) => {
          const member = memberByName.get(name);
          if (member && !member.deleted) this.activeList.marks[this.pasteDate][member.id] = true;
        });
        this.dateModes[this.pasteDate] = "all";
        this.closeModal();
        this.randomizeNotice(true);
      },

      openAddMembers() {
        this.memberText = "";
        this.modal = "members";
      },

      addMembersFromText() {
        this.addMembers(parseMembersText(this.memberText));
        this.closeModal();
      },

      addMembers(names) {
        const known = new Set(this.activeList.members.map((member) => member.name));
        unique(names).forEach((name) => {
          if (!known.has(name)) {
            this.activeList.members.push({ id: makeId("member"), name, deleted: false });
            known.add(name);
          }
        });
      },

      softDeleteMember(id) {
        const member = this.activeList.members.find((item) => item.id === id);
        if (member) member.deleted = true;
      },

      restoreMember(id) {
        const member = this.activeList.members.find((item) => item.id === id);
        if (member) member.deleted = false;
      },

      hardDeleteMember(id) {
        this.activeList.members = this.activeList.members.filter((member) => member.id !== id);
        Object.values(this.activeList.marks).forEach((marks) => delete marks[id]);
      },

      startSwipe(event, id) {
        const touch = event.changedTouches?.[0];
        if (touch) this.swipeStart = { id, x: touch.clientX };
      },

      endSwipe(event, id) {
        const touch = event.changedTouches?.[0];
        if (!touch || !this.swipeStart || this.swipeStart.id !== id) return;
        const delta = touch.clientX - this.swipeStart.x;
        this.swipeStart = null;
        if (Math.abs(delta) < 48) return;
        const member = this.activeList.members.find((item) => item.id === id);
        if (!member) return;
        if (delta < 0 && member.deleted) this.hardDeleteMember(id);
        else if (delta < 0) this.softDeleteMember(id);
        else if (member.deleted) this.restoreMember(id);
      },

      openListPanel() {
        this.listNameDraft = this.activeList.name;
        this.modal = "lists";
      },

      switchList(id) {
        this.store.activeListId = id;
        this.listNameDraft = this.activeList.name;
      },

      createList() {
        const id = makeId("list");
        this.store.lists.push({ id, name: this.listNameDraft || "新列表", members: [], marks: {}, dateModes: {} });
        this.store.activeListId = id;
      },

      renameList() {
        if (this.listNameDraft.trim()) this.activeList.name = this.listNameDraft.trim();
      },

      cloneList() {
        const copy = JSON.parse(JSON.stringify(this.activeList));
        copy.id = makeId("list");
        copy.name = `${copy.name} 副本`;
        copy.members.forEach((member) => {
          const oldId = member.id;
          const newId = makeId("member");
          member.id = newId;
          Object.values(copy.marks).forEach((marks) => {
            if (Object.prototype.hasOwnProperty.call(marks, oldId)) {
              marks[newId] = marks[oldId];
              delete marks[oldId];
            }
          });
        });
        this.store.lists.push(copy);
        this.store.activeListId = copy.id;
      },

      deleteList() {
        if (this.store.lists.length <= 1) return;
        this.store.lists = this.store.lists.filter((list) => list.id !== this.activeList.id);
        this.store.activeListId = this.store.lists[0].id;
      },

      openCsv() {
        this.modal = "csv";
      },

      downloadCsv() {
        const blob = new Blob([this.csvText], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${this.activeList.name}-接龙统计.csv`;
        link.click();
        URL.revokeObjectURL(url);
      },

      async copyText(text) {
        try {
          await navigator.clipboard.writeText(text || "");
        } catch (error) {
          const area = document.createElement("textarea");
          area.value = text || "";
          document.body.appendChild(area);
          area.select();
          document.execCommand("copy");
          area.remove();
        }
      },

      randomizeNotice(spark = false) {
        this.noticeSeed += 1;
        if (spark) {
          this.noticeSpark = false;
          requestAnimationFrame(() => {
            this.noticeSpark = true;
            setTimeout(() => (this.noticeSpark = false), 1000);
          });
        }
      },

      closeModal() {
        this.modal = "";
      }
    }
  }).mount("#app");

  function parseCheckinText(text) {
    return unique(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => line.replace(/^\d+\s*[.、)\-]?\s*/, "").trim())
        .filter(Boolean)
    );
  }

  function parseMembersText(text) {
    const atNames = [...text.matchAll(/@([^\s@]+)/g)].map((match) => match[1]);
    if (atNames.length) return unique(atNames);
    return unique(text.split(/[\n,，;；]+/));
  }

  function getInitialGroup(name) {
    const first = name.trim().charAt(0);
    if (!first) return "#";
    if (/^[a-z]$/i.test(first)) return first.toLowerCase();
    if (/^\d|[^\p{Script=Han}a-z]/iu.test(first)) return "#";
    const boundaries = [
      ["a", "阿"], ["b", "芭"], ["c", "嚓"], ["d", "搭"], ["e", "饿"],
      ["f", "发"], ["g", "旮"], ["h", "哈"], ["j", "击"], ["k", "喀"],
      ["l", "垃"], ["m", "妈"], ["n", "拿"], ["o", "噢"], ["p", "啪"],
      ["q", "期"], ["r", "然"], ["s", "撒"], ["t", "他"], ["w", "挖"],
      ["x", "昔"], ["y", "压"], ["z", "匝"]
    ];
    let group = "#";
    for (const [letter, boundary] of boundaries) {
      if (collator.compare(first, boundary) >= 0) group = letter;
      else break;
    }
    return group;
  }

  function buildNoticeData(members, marks, selectedDates, dateModes) {
    if (!selectedDates.length) {
      return {
        scene: "idle",
        primaryNames: [],
        rangeLabel: "未选择日期",
        dateLabel: "",
        days: 0,
        doneNames: [],
        missNames: []
      };
    }

    const dateKeys = selectedDates.map((date) => date.key);
    const doneRequest = selectedDates.some((date) => ["done", "all"].includes(dateModes[date.key]));
    const missingRequest = selectedDates.some((date) => ["missing", "all"].includes(dateModes[date.key]));
    const allDone = members.filter((member) => dateKeys.every((key) => marks[key]?.[member.id]));
    const hasMissing = members.filter((member) => dateKeys.some((key) => !marks[key]?.[member.id]));
    const rangeLabel = dateKeys.length === 1 ? shortDate(dateKeys[0]) : `${shortDate(dateKeys[0])} ~ ${shortDate(dateKeys[dateKeys.length - 1])}`;
    const isWeek = dateKeys.length === 7;

    let scene = "singleMissing";
    let primaryNames = hasMissing.map((member) => member.name);
    if (doneRequest && missingRequest) scene = "all";
    else if (doneRequest) {
      scene = dateKeys.length === 1 ? "singleDone" : isWeek ? "weekDone" : "rangeDone";
      primaryNames = allDone.map((member) => member.name);
    } else if (missingRequest) {
      scene = dateKeys.length === 1 ? "singleMissing" : "rangeMissing";
      primaryNames = hasMissing.map((member) => member.name);
    }

    if (!primaryNames.length && scene === "singleDone") scene = "emptyDone";
    if (!primaryNames.length && scene === "singleMissing") scene = "emptyMissing";

    return {
      scene,
      primaryNames,
      rangeLabel,
      dateLabel: shortDate(dateKeys[0]),
      days: dateKeys.length,
      doneNames: allDone.map((member) => member.name),
      missNames: hasMissing.map((member) => member.name)
    };
  }

  function renderNotice(data, templateBag, timeSlot, seed) {
    if (data.scene === "idle") return "点日期表头第三行的 ○，选择完成、未完成或全选，就会在这里生成通知文案。";
    const count = data.primaryNames.length;
    const values = {
      date: data.dateLabel,
      range: data.rangeLabel,
      days: data.days,
      count,
      names: namesLine(data.primaryNames),
      doneCount: data.doneNames.length,
      missCount: data.missNames.length,
      doneNames: namesLine(data.doneNames),
      missNames: namesLine(data.missNames),
      timeSlot: timeSlotText(timeSlot),
      greeting: greetingText(timeSlot)
    };
    const pool = getTemplatePool(templateBag, data.scene, timeSlot);
    const template = pool[Math.abs(seed) % pool.length] || "";
    return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  }

  function getTemplatePool(templateBag, scene, timeSlot) {
    const value = templateBag[scene];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [...(value[timeSlot] || []), ...(value.common || [])];
    return [""];
  }

  function namesLine(names) {
    return names.length ? names.map((name) => `@${name}`).join(" ") : "无";
  }

  function getTimeSlot(date) {
    const hour = date.getHours();
    if (hour >= 5 && hour <= 10) return "morning";
    if (hour >= 11 && hour <= 13) return "noon";
    if (hour >= 14 && hour <= 17) return "afternoon";
    if (hour >= 18 && hour <= 22) return "evening";
    return "late";
  }

  function timeSlotText(slot) {
    return { morning: "早上", noon: "中午", afternoon: "下午", evening: "晚上", late: "深夜" }[slot] || "现在";
  }

  function greetingText(slot) {
    return { morning: "早上好", noon: "午间提醒", afternoon: "下午加油", evening: "晚上收尾", late: "夜深了" }[slot] || "提醒";
  }

  function shortDate(key) {
    return key.slice(5);
  }

  function csvCell(value) {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
})();
