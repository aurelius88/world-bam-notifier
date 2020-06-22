module.exports = function WorldBamNotifier(mod) {
  const toClient = mod.toClient.bind(mod);
  // key = huntingZoneId:templateId
  let WorldBosses = new Map();

  mod
    .queryData("/NpcData/", [], true, true, ["huntingZoneId", "id", "npcType", "level", "maxHp", "atk", "def"])
    .then(retrieveWorldBosses)
    .then(addWorldBossStrings)
    .then(result => {
      let { promises, worldBosses } = result;
      return Promise.all(promises).then(() => (WorldBosses = worldBosses));
    });

  const msgObject = {
      type: 42, // 42 Blue Shiny Text, 31 Normal Text
      chat: 0,
      channel: 27,
      message: ""
    },
    whisperObj = {
      channel: 7,
      authorName: "world-bam",
      message: ""
    };

  const systemMessage = msg => {
    msgObject.message = whisperObj.message = msg;
    toClient("S_CHAT", 3, whisperObj);
    toClient("S_DUNGEON_EVENT_MESSAGE", 2, msgObject);
  };

  mod.hook("S_SPAWN_NPC", 11, event => {
    const { templateId, huntingZoneId } = event;
    if (WorldBosses.has(`${huntingZoneId}:${templateId}`)) {
      let boss = WorldBosses.get(`${huntingZoneId}:${templateId}`);
      let message = `BAM found: ${boss.Stat && boss.Stat.length > 0 ? `[${boss.Stat[0].level}]` : ""}${
        boss.title ? `${boss.title} ` : ""
      }${boss.name ? boss.name : "(unknown)"}`;
      mod.log(message);
      systemMessage(message);
    }
  });

  function retrieveWorldBosses(results) {
    let huntingZoneTemplateIds = new Map();
    let worldBosses = new Map();
    for (let npc of results) {
      let currentHuntingZoneId = npc.attributes.huntingZoneId;
      npc.children.forEach(tmp => {
        if (tmp.name === "Template" && tmp.attributes.npcType == "fieldboss") {
          let templateId = tmp.attributes.id;
          let templateIds = huntingZoneTemplateIds.get(currentHuntingZoneId);
          if (templateIds) templateIds.push(templateId);
          else huntingZoneTemplateIds.set(currentHuntingZoneId, [templateId]);
          let data = {
            huntingZoneId: currentHuntingZoneId,
            templateId: templateId,
            npcType: tmp.attributes.npcType,
            Stat: tmp.children.filter(child => child.name === "Stat").map(stat => stat.attributes)
          };
          worldBosses.set(`${currentHuntingZoneId}:${templateId}`, data);
        }
      });
    }
    return { worldBosses, huntingZoneTemplateIds };
  }

  function addWorldBossStrings(result) {
    let { huntingZoneTemplateIds, worldBosses } = result;
    let promises = [];
    for (let hzId of huntingZoneTemplateIds.keys()) {
      let tmpIds = huntingZoneTemplateIds.get(hzId);
      promises.push(
        mod
          .queryData("/StrSheet_Creature/HuntingZone@id=?/String@templateId=?/", [hzId, tmpIds], true, false)
          .then(stringData => tmpIds.forEach(tmpId => resolveWorldBossStrings(hzId, tmpId, worldBosses)(stringData)))
          .catch(msg => mod.error(msg))
      );
    }
    return { promises, worldBosses };
  }

  function resolveWorldBossStrings(hzId, tmpId, worldBosses) {
    return stringData => {
      stringData.forEach(stringObj => Object.assign(worldBosses.get(`${hzId}:${tmpId}`), stringObj.attributes));
    };
  }
};
