# -*- coding: utf-8 -*-
"""
낱말 사진 모으기 — words.ts의 낱말마다 **실제 사진** 한 장을 찾아 256×256으로 저장한다.

왜 위키인가: 구글 이미지 같은 것을 긁으면 저작권을 알 수 없다. Wikimedia Commons의 파일은 라이선스가 적혀 있어
(CC BY / CC BY-SA / 퍼블릭 도메인) 아이 앱에 써도 되고, 대신 **저작자와 라이선스를 함께 남겨야** 한다 →
credits.json에 사진마다 적는다.

찾는 순서 (앞이 정확하다):
 1. 영어 위키백과 문서의 **대표 사진**(cat → "Cat" 문서의 첫 사진) — 그 낱말의 표준 그림이다
 2. Commons에서 **제목에 낱말이 든** 사진 (intitle:duck)
 3. Commons 본문 검색 — 가장 흐릿하다. 처음에 이것만 썼더니 duck이 도날드덕 상점 쇼윈도(흑백)로 나왔다
어느 경로든 흑백·도표·지도·로고는 거른다.

사용: python tools/fetch-pics.py [--only cat,dog] [--force]
출력: src/data/words_pic/<낱말>.jpg (256×256, 가운데 정사각형으로 잘라 줄임) + public/words_pic/credits.json
"""
import io, json, re, sys, time, argparse
from pathlib import Path

import requests
from PIL import Image, ImageStat

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
WORDS_TS = ROOT / 'src' / 'data' / 'words.ts'
OUT = ROOT / 'src' / 'data' / 'words_pic'
COMMONS = 'https://commons.wikimedia.org/w/api.php'
WIKI = 'https://en.wikipedia.org/w/api.php'
HEADERS = {'User-Agent': 'english-nori/1.0 (children phonics app; parksw20@gmail.com)'}
SIZE = 256

# 낱말 그대로 찾으면 엉뚱한 것이 잡히는 낱말은 **사진용 검색어**를 따로 둔다
# (run → "Jonathan's Run" 폭포, apple → Apple II 컴퓨터, big → 빅맥이 나왔다). 동사는 그 동작 문서로, 색은 색 문서로.
PHOTO_QUERY = {
    'apple': 'Apple', 'shop': 'Grocery store', 'stop': 'Stop sign', 'song': 'Choir', 'close': 'Padlock', 'shorts': 'Bermuda shorts', 'boots': 'Wellington boot', 'pet': 'Puppy', 'thanks': 'Gratitude', 'sorry': 'Apology', 'lamp': 'Incandescent light bulb', 'mat': 'Yoga mat', 'run': 'Running', 'swim': 'Swimming', 'sit': 'Sitting', 'walk': 'Walking',
    'talk': 'Conversation', 'write': 'Handwriting', 'draw': 'Drawing', 'sing': 'Singing', 'read': 'Reading',
    'eat': 'Eating', 'drink': 'Drinking', 'sleep': 'Sleep', 'clap': 'Applause', 'play': 'Play (activity)',
    'close': 'Door', 'give': 'Gift', 'catch': 'Catch (baseball)', 'look': 'Human eye', 'listen': 'Listening',
    'ride': 'Cycling', 'drive': 'Driving', 'point': 'Pointing', 'count': 'Counting', 'know': 'Book',
    'love': 'Heart symbol', 'big': 'Elephant', 'small': 'Ant', 'hot': 'Fire', 'sad': 'Crying', 'happy': 'Laughter',
    'angry': 'Anger', 'fun': 'Playground', 'nice': 'Thumbs up', 'good': 'Thumb signal', 'cool': 'Sunglasses',
    'new': 'Gift', 'long': 'Ruler', 'short': 'Ruler', 'clean': 'Soap', 'sweet': 'Candy', 'great': 'Trophy',
    'sorry': 'Bowing', 'again': 'Arrow', 'today': 'Calendar', 'thanks': 'Namaste', 'goodbye': 'Waving',
    'name': 'Name tag', 'time': 'Clock', 'page': 'Page (paper)', 'day': 'Daytime', 'night': 'Night',
    'morning': 'Sunrise', 'evening': 'Sunset', 'afternoon': 'Afternoon', 'lunch': 'Lunch', 'dinner': 'Dinner',
    'breakfast': 'Breakfast', 'food': 'Food', 'room': 'Room', 'home': 'House', 'kitchen': 'Kitchen',
    'mat': 'Doormat', 'rug': 'Rug', 'pet': 'Pet', 'man': 'Man', 'men': 'Man', 'kid': 'Child', 'child': 'Child',
    'children': 'Child', 'boy': 'Boy', 'girl': 'Girl', 'mum': 'Mother', 'dad': 'Father', 'grandma': 'Grandparent',
    'grandpa': 'Grandparent', 'grandmother': 'Grandparent', 'grandfather': 'Grandparent', 'sister': 'Sibling',
    'brother': 'Sibling', 'classmate': 'Classroom', 'people': 'People', 'friend': 'Friendship', 'teacher': 'Teacher',
    'red': 'Strawberry', 'yellow': 'Banana', 'blue': 'Sky', 'green': 'Leaf', 'black': 'Crow', 'white': 'Polar bear',
    'pink': 'Flamingo', 'brown': 'Brown bear', 'purple': 'Eggplant', 'colour': 'Rainbow', 'zoo': 'Zoo',
    'six': '6 (number)', 'ten': '10 (number)', 'four': '4 (number)', 'five': '5 (number)', 'seven': '7 (number)',
    'eight': '8 (number)', 'nine': '9 (number)', 'ice cream': 'Ice cream', 'ice': 'Ice cube', 'wave': 'Wind wave',
    'shell': 'Seashell', 'fishing': 'Fishing', 'chips': 'French fries', 'juice': 'Orange juice', 'lime': 'Lime (fruit)',
    'mice': 'Mouse', 'mouse': 'Mouse', 'bat': 'Baseball bat', 'pot': 'Cooking pot', 'van': 'Van',
    'box': 'Cardboard box', 'sand': 'Sand', 'bath': 'Bathtub', 'photo': 'Photograph', 'song': 'Sheet music',
    'game': 'Board game', 'face': 'Face', 'smile': 'Smile', 'hand': 'Hand', 'leg': 'Human leg', 'ear': 'Ear',
    'feet': 'Foot', 'foot': 'Foot', 'arm': 'Arm', 'mouth': 'Mouth', 'nose': 'Human nose', 'phone': 'Smartphone',
    'plane': 'Airplane', 'star': 'Star', 'jeans': 'Jeans', 'dress': 'Dress', 'shorts': 'Shorts', 'boots': 'Boot',
    'shoe': 'Shoe', 'clothes': 'Clothing', 'glasses': 'Glasses', 'watch': 'Watch', 'clock': 'Clock',
    'paint': 'Paint', 'crayon': 'Crayon', 'ruler': 'Ruler', 'paper': 'Paper', 'book': 'Book', 'bag': 'Bag',
    'handbag': 'Handbag', 'doll': 'Doll', 'teddy': 'Teddy bear', 'toy': 'Toy', 'balloon': 'Balloon',
    'tennis': 'Tennis ball', 'basketball': 'Basketball', 'football': 'Football', 'bike': 'Bicycle',
    'car': 'Car', 'truck': 'Truck', 'bus': 'Bus', 'train': 'Train', 'boat': 'Boat', 'motorbike': 'Motorcycle',
    'helicopter': 'Helicopter', 'skateboard': 'Skateboard', 'keyboard': 'Musical keyboard',
    'garden': 'Garden', 'park': 'Park', 'beach': 'Beach', 'school': 'School', 'playground': 'Playground',
    'bedroom': 'Bedroom', 'bathroom': 'Bathroom', 'classroom': 'Classroom', 'bookcase': 'Bookcase',
    'bookshop': 'Bookshop', 'armchair': 'Armchair', 'cupboard': 'Cupboard', 'apartment': 'Apartment',
    'window': 'Window', 'door': 'Door', 'wall': 'Wall', 'lamp': 'Lamp', 'mirror': 'Mirror', 'bed': 'Bed',
    'chair': 'Chair', 'shop': 'Shop', 'birthday': 'Birthday cake', 'meatballs': 'Meatball', 'egg': 'Egg',
    'meat': 'Meat', 'bread': 'Bread', 'rice': 'Rice', 'cake': 'Cake', 'pie': 'Pie', 'candy': 'Candy',
    'chocolate': 'Chocolate', 'sausage': 'Sausage', 'burger': 'Hamburger', 'carrot': 'Carrot', 'pea': 'Pea',
    'pear': 'Pear', 'grape': 'Grape', 'mango': 'Mango', 'orange': 'Orange (fruit)', 'watermelon': 'Watermelon',
    'pineapple': 'Pineapple', 'lemonade': 'Lemonade', 'water': 'Drinking water', 'sun': 'Sun', 'monster': 'Monster',
    'queen': 'Queen regnant', 'umbrella': 'Umbrella', 'kite': 'Kite', 'jacket': 'Jacket', 'shirt': 'Shirt',
    'pen': 'Pen', 'fox': 'Fox', 'pig': 'Pig', 'goat': 'Goat', 'hat': 'Hat', 'skateboarding': 'Skateboarding',
    'jellyfish': 'Jellyfish', 'giraffe': 'Giraffe', 'lizard': 'Lizard', 'spider': 'Spider', 'bird': 'Bird',
    'horse': 'Horse', 'cow': 'Cattle', 'sheep': 'Sheep', 'bee': 'Bee', 'tree': 'Tree', 'flower': 'Flower',
}

# 위 표에 같은 키가 두 번 있으면 파이썬은 **뒤의 것**을 쓴다 — 앞쪽에 넣은 고침이 조용히 무시됐다(shop이 하시시 가게로 남았다).
# 그래서 고친 검색어는 여기서 덮어쓴다.
PHOTO_QUERY.update({
    'shop': 'Grocery store', 'stop': 'Stop sign', 'song': 'Choir', 'close': 'Padlock', 'shorts': 'Bermuda shorts',
    'boots': 'Wellington boot', 'pet': 'Puppy', 'thanks': 'Gratitude', 'sorry': 'Apology', 'lamp': 'Incandescent light bulb',
    'mat': 'Yoga mat', 'nose': 'Human nose', 'yellow': 'Banana', 'mirror': 'Mirror', 'leg': 'Human leg',
    'yellow': 'Lemon', 'thanks': 'Hug',
    # 표 4장을 눈으로 훑고 고친 것들(2026-09-04): 옛 도판·흑백·통계 사진이 잡힌 낱말
    'bathroom': 'Shower', 'clothes': 'T-shirt', 'door': 'Front door', 'draw': 'Coloring book', 'drawing': 'Child art',
    'egg': 'Egg as food', 'hat': 'Cowboy hat', 'house': 'Single-family detached home', 'home': 'Cottage', 'leg': 'Knee',
    'mother': 'Family', 'mum': 'Woman', 'mouth': 'Human mouth', 'pot': 'Cookware and bakeware', 'read': 'Bedtime story',
    'rice': 'Cooked rice', 'room': 'Living room', 'wall': 'Brick', 'write': 'Notebook', 'trousers': 'Cargo pants',
    'keyboard': 'Electronic keyboard', 'apartment': 'Apartment building', 'people': 'Crowd', 'eat': 'Eating',
})

# 사진이 아니라 도표·지도·로고·깃발일 가능성이 큰 제목은 거른다
# 낱말 경계(\b)를 꼭 둔다 — 'graph'가 geograph.org.uk·photography에 걸려 동물원·시계 대표 사진을 버렸다
BAD_TITLE = re.compile(r'\b(map|diagram|logo|flag|coat of arms|icon|chart|graph|drawing|sketch|clipart|illustration|poster|cover|screenshot|symbol|emblem|banner|font|comic|cartoon|donald)\b', re.I)


def parse_words():
    """words.ts에서 WORDS(단계가 있는 것)만 뽑는다 — sight word는 그림이 없는 낱말이라 뺀다"""
    src = io.open(WORDS_TS, encoding='utf-8').read()
    out = []
    for m in re.finditer(r"\{\s*en:\s*'([^']+)',\s*ko:\s*'([^']+)'[^}]*?stage:\s*(\d)[^}]*\}", src):
        out.append({'en': m.group(1), 'ko': m.group(2), 'stage': int(m.group(3)),
                    'abstract': 'abstract: true' in m.group(0), 'number': "source: 'number'" in m.group(0)})
    return out


def get(url, params):
    r = requests.get(url, params=params, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def file_info(titles):
    """Commons 파일들의 크기·MIME·썸네일·라이선스"""
    data = get(COMMONS, {
        'action': 'query', 'format': 'json', 'titles': '|'.join(titles),
        'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': 640,
        'iiextmetadatafilter': 'Artist|LicenseShortName|LicenseUrl',
    })
    out = []
    for p in data.get('query', {}).get('pages', {}).values():
        info = (p.get('imageinfo') or [None])[0]
        if info:
            out.append(candidate(p.get('title', ''), info))
    return [c for c in out if c]


def candidate(title, info):
    # 위키 대표 사진은 PNG인 것도 많다(색 문서의 색 견본 등) → JPEG·PNG를 받는다. SVG·GIF는 사진이 아니다
    if info.get('mime') not in ('image/jpeg', 'image/png'):
        return None
    w, h = info.get('width', 0), info.get('height', 0)
    # 너무 길쭉하면 가운데를 잘라도 이상하다. 2.2로 두었더니 사과 대표 사진(2800×950, 사과와 단면)이 잘렸다 → 3.0
    # 256px로 줄여 쓰니 원본이 300px이어도 된다(코·거울·바나나 대표 사진이 300px대라 버려지고 있었다)
    if w < 256 or h < 256 or max(w, h) / max(1, min(w, h)) > 3.0:
        return None
    if BAD_TITLE.search(title):
        return None
    meta = info.get('extmetadata', {})
    lic = meta.get('LicenseShortName', {}).get('value', '')
    if not lic:
        return None
    return {
        'title': title,
        'thumb': info.get('thumburl') or info.get('url'),
        'page': info.get('descriptionurl') or f'https://commons.wikimedia.org/wiki/{title}',
        'artist': re.sub(r'<[^>]+>', '', meta.get('Artist', {}).get('value', '')).strip()[:120],
        'license': lic,
        'licenseUrl': meta.get('LicenseUrl', {}).get('value', ''),
    }


def from_wikipedia(word):
    """영어 위키백과 문서의 대표 사진 (문서가 있고 그 사진이 Commons에 있을 때)"""
    data = get(WIKI, {'action': 'query', 'format': 'json', 'titles': word, 'redirects': 1,
                      'prop': 'pageimages|pageprops', 'piprop': 'name'})
    for p in data.get('query', {}).get('pages', {}).values():
        if 'missing' in p or 'disambiguation' in p.get('pageprops', {}):
            continue
        name = p.get('pageimage')
        if name:
            return file_info([f'File:{name}'])
    return []


def from_commons(word, intitle):
    q = f'intitle:{word} filetype:bitmap' if intitle else f'"{word}" filetype:bitmap'
    data = get(COMMONS, {
        'action': 'query', 'format': 'json',
        'generator': 'search', 'gsrsearch': q, 'gsrnamespace': 6, 'gsrlimit': 12,
        'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': 640,
        'iiextmetadatafilter': 'Artist|LicenseShortName|LicenseUrl',
    })
    pages = sorted(data.get('query', {}).get('pages', {}).values(), key=lambda x: x.get('index', 999))
    out = []
    for p in pages:
        info = (p.get('imageinfo') or [None])[0]
        if info:
            c = candidate(p.get('title', ''), info)
            if c:
                out.append(c)
    return out


def fetch_square(url, solid=False, trusted=False):
    """받아서 가운데 정사각형으로 자르고 256으로 줄인다. 흑백(채도가 낮음)이면 None"""
    r = requests.get(url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    im = Image.open(io.BytesIO(r.content))
    if im.mode in ('RGBA', 'LA', 'P'):  # 투명 PNG는 흰 바탕에 얹는다
        im = im.convert('RGBA')
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        im = bg
    im = im.convert('RGB')
    sat = ImageStat.Stat(im.convert('HSV')).mean[1]
    # 흑백 사진·옛 기록 사진은 아이가 알아보기 어렵다. 다만 색 견본(black·white)은 채도가 0이라 봐준다
    # 22로 두었더니 흰 바탕의 펜·흰빛의 해처럼 색이 옅은 멀쩡한 사진까지 버렸다 → 거의 회색(8 미만)만 거른다
    # 위키 대표 사진(trusted)은 편집자가 고른 것이라 채도로 거르지 않는다 — 흰 바탕의 펜·전구를 버리고 있었다
    if sat < 8 and not solid and not trusted:
        return None
    w, h = im.size
    s = min(w, h)
    left, top = (w - s) // 2, (h - s) // 2
    return im.crop((left, top, left + s, top + s)).resize((SIZE, SIZE), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='쉼표로 나눈 낱말만')
    ap.add_argument('--force', action='store_true', help='이미 있는 사진도 다시 받는다')
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    credits_path = OUT / 'credits.json'
    credits = json.loads(credits_path.read_text(encoding='utf-8')) if credits_path.exists() else {}
    words = parse_words()
    if args.only:
        keep = set(args.only.split(','))
        words = [w for w in words if w['en'] in keep]
    print(f'낱말 {len(words)}개')

    ok, miss, skipped = [], [], []
    for i, w in enumerate(words, 1):
        if w['number']:
            skipped.append(w['en'])
            continue
        slug = w['en'].replace(' ', '-')
        path = OUT / f'{slug}.jpg'
        if path.exists() and not args.force and slug in credits:
            ok.append(w['en'])
            continue
        try:
            picked = None
            q = PHOTO_QUERY.get(w['en'], w['en'])
            solid = w['en'] in ('red', 'yellow', 'blue', 'green', 'black', 'white', 'pink', 'brown', 'purple')
            for how, cands in (('위키 대표', from_wikipedia(q)),
                               ('제목', from_commons(q, True)),
                               ('본문', from_commons(q, False))):
                for c in cands[:4]:
                    im = fetch_square(c['thumb'], solid, trusted=(how == '위키 대표'))
                    if im is not None:
                        picked = (how, c, im)
                        break
                if picked:
                    break
            if not picked:
                miss.append(w['en'])
                print(f'  [{i:3}] {w["en"]:<14} — 쓸 만한 사진 없음')
                continue
            how, c, im = picked
            im.save(path, 'JPEG', quality=86, optimize=True)
            credits[slug] = {'en': w['en'], 'ko': w['ko'], 'file': c['title'], 'page': c['page'], 'artist': c['artist'],
                             'license': c['license'], 'licenseUrl': c['licenseUrl'], 'how': how}
            credits_path.write_text(json.dumps(credits, ensure_ascii=False, indent=1), encoding='utf-8')
            ok.append(w['en'])
            print(f'  [{i:3}] {w["en"]:<14} ← [{how}] {c["title"][:55]} ({c["license"]})')
        except Exception as e:  # 한 낱말이 실패해도 나머지는 계속
            miss.append(w['en'])
            print(f'  [{i:3}] {w["en"]:<14} — 실패: {e}')
        time.sleep(0.3)  # 공용 API 예의

    print(f'\n받음 {len(ok)}개 · 못 받음 {len(miss)}개 · 건너뜀(숫자) {len(skipped)}개: {", ".join(skipped)}')
    if miss:
        print('못 받은 낱말:', ', '.join(miss))
    abstract_ok = [w['en'] for w in words if w['abstract'] and w['en'] in ok]
    if abstract_ok:
        print('\n그림으로 뜻이 안 드러나는 낱말(abstract)도 받았다 — 눈으로 확인 필요:', ', '.join(abstract_ok))


if __name__ == '__main__':
    main()
