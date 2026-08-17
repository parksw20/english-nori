import { defineConfig } from 'vite'

// 포트는 고정한다. 자동 증가(+1)로 옮겨 다니면 "열어 볼 주소"와 실제 주소가 갈린다.
// 5300은 한자놀이가 쓰고 있어 5310을 쓴다.
export default defineConfig({
  // GitHub Pages는 /<저장소이름>/ 아래에 서비스된다. 상대 경로로 두면
  // Pages·로컬 preview·파일 열기가 전부 같은 산출물로 동작한다.
  base: './',
  server: { host: 'localhost', port: 5310, strictPort: true },
  preview: { host: 'localhost', port: 5310, strictPort: true },
})
