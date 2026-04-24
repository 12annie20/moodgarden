# MoodGarden 情緒模型

MoodGarden 採用 **Plutchik 情緒輪** 與 **Russell 環形模型** 雙軌設計，兼顧「離散情緒選擇的直觀」與「二維連續空間的精細」。本文說明模型如何映射到資料欄位與 UI。

---

## Plutchik 情緒輪（Plutchik, 1980; 2001）

八種主要情緒，兩兩配對為四組對立：

| 對立組 | 正面 | 負面 |
|---|---|---|
| 生存–拒絕 | 信任 Trust | 厭惡 Disgust |
| 目標–威脅 | 喜悅 Joy | 悲傷 Sadness |
| 威脅–消除 | 恐懼 Fear | 憤怒 Anger |
| 新奇–規律 | 驚訝 Surprise | 期待 Anticipation |

每種主要情緒有 **3 級強度**（淡 → 中 → 強）。相鄰情緒的組合可形成二級情緒（例如喜悅 + 信任 = 愛），MoodGarden 利用此機制作為「特殊小生物」的孵化條件。

### 在資料模型中的對應
```
mood_entries.primary_emotion     plutchik_emotion_t  -- 8 enum 值
mood_entries.plutchik_intensity  smallint 1..3
mood_entries.secondary_emotion   plutchik_emotion_t  -- nullable, 用於組合情緒
```

---

## Russell 環形模型（Russell, 1980）

把所有情緒放在二維空間上：
- **Valence（愉悅度）**：水平軸，-1（極不悅）到 +1（極愉悅）
- **Arousal（喚起度）**：垂直軸，-1（極平靜）到 +1（極激動）

例：興奮 ≈ 高 valence 高 arousal；放鬆 ≈ 高 valence 低 arousal；憤怒 ≈ 低 valence 高 arousal；憂鬱 ≈ 低 valence 低 arousal。

### 在資料模型中的對應
```
mood_entries.valence  numeric(3,2) in [-1, 1]
mood_entries.arousal  numeric(3,2) in [-1, 1]
```

---

## UI 流程（情緒記錄 Modal）

1. **Step 1 — Plutchik 輪選擇**
   點選 8 個圓輪狀按鈕之一為「主要情緒」。按鈕配色遵循 Plutchik 原版（喜悅黃 / 信任綠 / 恐懼深綠 / 驚訝青藍 / 悲傷藍 / 厭惡紫 / 憤怒紅 / 期待橘）。

2. **Step 2 — Russell 圓盤拖曳**
   一個圓形畫布，中心為 (0,0)。使用者拖曳一顆小點，定位此刻的愉悅/喚起座標。背景色隨位置漸變（暗藍←→暖橘，深→淺）。

3. **Step 3 — 文字標籤**（可選，≤60 字）
   自由輸入，未來做 sentiment 細粒度分析。

4. **Step 4 — 是否分享到社群**
   預設開，使用者可關。開啟時寫入 `social_posts`。

---

## 小生物對應（基礎設計）

| Plutchik 情緒 | 小生物種類（暫名） | 主視覺 |
|---|---|---|
| 喜悅 Joy | 光點鹿 | 金黃絨毛、眼睛閃爍 |
| 信任 Trust | 扎根蘑 | 圓潤、會向人靠近 |
| 恐懼 Fear | 躲貓苗 | 躲在葉後探頭 |
| 驚訝 Surprise | 彈跳豆 | 會彈跳、耳朵豎起 |
| 悲傷 Sadness | 雨滴水母 | 半透明藍、拖水跡 |
| 厭惡 Disgust | 刺刺草 | 皺眉、帶刺 |
| 憤怒 Anger | 焰毛兔 | 紅尾、噴煙 |
| 期待 Anticipation | 星望鳥 | 仰望、長尾 |

組合情緒孵出「稀有種」的觸發條件見 [lib/creatures.ts](../lib/creatures.ts)（待實作）。

---

## 學術出處

- Plutchik, R. (1980). *Emotion: A Psychoevolutionary Synthesis.* Harper & Row.
- Plutchik, R. (2001). The nature of emotions. *American Scientist, 89*(4), 344–350. <https://doi.org/10.1511/2001.28.344>
- Russell, J. A. (1980). A circumplex model of affect. *Journal of Personality and Social Psychology, 39*(6), 1161–1178. <https://doi.org/10.1037/h0077714>
- Posner, J., Russell, J. A., & Peterson, B. S. (2005). The circumplex model of affect: An integrative approach to affective neuroscience, cognitive development, and psychopathology. *Development and Psychopathology, 17*(3), 715–734. <https://doi.org/10.1017/S0954579405050340>
