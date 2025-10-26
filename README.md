# 🧠 VSCode AI App (Modified from Microsoft VSCode)

## Screenshot UI of Integrated AI App

<p align="center">
  <img alt="VS Code in action" src="./assets/Screenshot 2025-10-27 .png">
</p>

## How to run it

Anh có thể clone về và chạy như 1 dự án VScode bình thường, nhưng có 1 vài điều đặc biệt cần lưu ý:

* Sau khi cài đặt hết các dependencies(npm ci) như dự án VScode gốc, thực hiện compile bằng lệnh "npx gulp compile"

* Sau khi đã hoàn tất bước trên và compile thành công, bắt đầu build VSCode phiên bản web browser bằng lệnh "node ./scripts/code-web.js". Mặc định web sẽ chạy ở: http://localhost:8080. Truy cập sẽ thấy UI của VSCode bản web browser, tương đồng gần như 100% với bản VSCode chạy bằng Electron trên desktop

* Start Node.js Backend, đây là điều cần thiết vì AI chatbox connect LLM thông qua server em tự viết này, đây là đường dẫn chứa file source của NodeJs server: ./src/vs/workbench/browser/parts/editor/api/api.js, start server này bằng lênh: "npx ts-node api.ts". Em sẽ để nó chạy mặc định ở port 3000. Chatbox sẽ gửi request tới server này để gọi API Gemini. Vì connect API Gemini thông qua API key, bình thường em sẽ không dám commit key lên github nhưng key này của Gemini Google có rate limit nên em để sẵn key cho anh gọi luôn

* Vì đề bảo rằng modify lại core UI của VSCode nên em đã dùng chính waterMark mặc định của Vscode để chứa AI App này. Đa phần code sẽ nằm trong ./src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts

## Trở ngại

* Embedded Browser em dùng bằng iframe nên có 1 số web sẽ không load ra được vì bị chặn CSP, cross-origin. Nhưng chatbox vẫn sẽ tóm tắt được nội dung của web vì Gemini có khả năng tự crawl nội dung của web về

