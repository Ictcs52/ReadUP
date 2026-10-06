# ชุดเสียงฝึกอ่าน

ยังไม่มีไฟล์เสียงที่ครูตรวจรับในโฟลเดอร์นี้ แอปจะแจ้งและใช้เสียงไทยของอุปกรณ์แทน

ให้อัดเสียงครูไทยที่ชัดเจนในห้องเงียบ ไม่ใส่เพลงพื้นหลัง แยกไฟล์ชื่อพยัญชนะจากไฟล์คำเดี่ยว และตรวจการออกเสียงก่อนใช้กับเด็ก หรือสร้างเสียงไทยจาก Google Cloud Text-to-Speech / Azure Speech แล้วตรวจและส่งออก MP3

| ข้อความในบทเรียน | ชื่อไฟล์ที่แนะนำ |
|---|---|
| กอ ไก่ | ko-kai.mp3 |
| มอ ม้า | mo-ma.mp3 |
| ปอ ปลา | po-pla.mp3 |
| รอ เรือ | ro-ruea.mp3 |
| บอ ใบไม้ | bo-baimai.mp3 |
| ไก่ | kai.mp3 |
| ม้า | ma.mp3 |
| ปลา | pla.mp3 |
| เรือ | ruea.mp3 |
| ใบไม้ | baimai.mp3 |

1. วางไฟล์ใน `public/audio/` ใช้ MP3, WAV, OGG หรือ M4A ชื่อไฟล์ภาษาอังกฤษตามตาราง
2. แก้ `src/data/audio.json` เช่น `"กอ ไก่": "audio/ko-kai.mp3"` แทน `null`
3. Build/deploy แล้วทดลองฟังจากมือถือและคอมพิวเตอร์

ไฟล์เหล่านี้เป็นเสียงตัวอย่างการสอนที่เผยแพร่สาธารณะกับเว็บ ไม่ใช้เก็บเสียงนักเรียนหรือข้อมูลส่วนบุคคล ตรวจสิทธิ์การใช้เสียงให้เหมาะสม ไม่ใส่ API key ของบริการเสียงใน frontend

แหล่งอ้างอิง:
- https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=text-to-speech
- https://www.w3.org/WAI/media/av/av-content/
