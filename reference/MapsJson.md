（参考）
`https://maps.geoguess.games/maps.json`のJSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://maps.geoguess.games/maps.schema.json",
  "title": "GeoGuess Maps Catalog",
  "description": "GeoGuess が起動時に読み込むマップカタログ。maps は通常の位置当てモード用、areas は地域名当てモード用。",
  "type": "object",
  "required": ["maps", "areas"],
  "additionalProperties": false,
  "properties": {
    "maps": {
      "type": "array",
      "items": { "$ref": "#/$defs/map" }
    },
    "areas": {
      "type": "array",
      "items": { "$ref": "#/$defs/area" }
    }
  },
  "$defs": {
    "localizedString": {
      "title": "LocalizedString",
      "description": "言語コード（ISO 639 系。'ja', 'en', 'zh' のほか 'kaa', 'lol' なども出現）をキーとする多言語文字列。実データでは 'en' がほぼ常に存在するが必須ではない。",
      "type": "object",
      "minProperties": 1,
      "patternProperties": {
        "^[a-z]{2,3}(-[A-Za-z0-9]+)*$": { "type": "string" }
      },
      "additionalProperties": false
    },
    "map": {
      "title": "Map",
      "description": "通常モード用マップ。url が指す先は GeoJSON（RFC 7946）で、出題地点（Point / Polygon）を含む。",
      "type": "object",
      "required": ["name", "description", "imageUrl", "url", "id"],
      "additionalProperties": false,
      "properties": {
        "name": { "$ref": "#/$defs/localizedString" },
        "description": { "$ref": "#/$defs/localizedString" },
        "author": {
          "type": "string",
          "description": "作成者・データ出典。空文字列の場合あり。"
        },
        "imageUrl": {
          "type": "string",
          "format": "uri",
          "description": "一覧表示用サムネイル画像のURL。"
        },
        "url": {
          "type": "string",
          "format": "uri",
          "description": "出題地点データ（GeoJSON）のURL。"
        },
        "id": {
          "type": "string",
          "description": "マップの一意識別子（スラッグ）。"
        }
      }
    },
    "area": {
      "title": "Area",
      "description": "地域名当てモード用マップ。data.urlArea が境界ポリゴンの GeoJSON を指す。",
      "type": "object",
      "required": ["name", "description", "imageUrl", "data", "id"],
      "additionalProperties": false,
      "properties": {
        "name": { "$ref": "#/$defs/localizedString" },
        "description": { "$ref": "#/$defs/localizedString" },
        "author": { "type": "string" },
        "imageUrl": {
          "type": "string",
          "format": "uri"
        },
        "data": { "$ref": "#/$defs/areaData" },
        "id": { "type": "string" }
      }
    },
    "areaData": {
      "title": "AreaData",
      "type": "object",
      "required": ["urlArea", "type", "pathKey"],
      "additionalProperties": false,
      "properties": {
        "urlArea": {
          "type": "string",
          "format": "uri",
          "description": "行政区画などの境界ポリゴンを含む GeoJSON のURL。"
        },
        "type": {
          "type": "string",
          "enum": ["polygon", "nominatim"],
          "description": "判定方式。polygon: ポリゴン内外判定のみ。nominatim: OSM Nominatim の逆ジオコーディング結果と照合する。"
        },
        "pathKey": {
          "type": "string",
          "description": "GeoJSON の feature.properties 内で地域名を保持するプロパティ名（例: 'nom', 'name', 'ESTADO'）。"
        },
        "bbox": {
          "type": "array",
          "description": "出題範囲のバウンディングボックス。座標4値だが、実データでは要素順が一貫していない点に注意。",
          "items": { "type": "number" },
          "minItems": 4,
          "maxItems": 4
        },
        "nominatimResultPath": {
          "type": "string",
          "description": "Nominatim レスポンス内で地域名を取り出すパス（例: 'address.state'）。type が nominatim の場合に使用。"
        },
        "nominatimFallbackResultPath": {
          "type": "string",
          "description": "nominatimResultPath で取得できなかった場合の代替パス（例: 'display_name'）。"
        },
        "nominatimQueryParams": {
          "type": "object",
          "description": "Nominatim へのクエリパラメータ（zoom, addressdetails, accept-language など）。値はすべて文字列。",
          "additionalProperties": { "type": "string" }
        }
      }
    }
  }
}
```
