# bloomberg_websocket_server.py

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Set
import blpapi
import websockets
from websockets.server import WebSocketServerProtocol

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BloombergDataService:
    """Bloomberg APIとの接続を管理し、マーケットデータを取得"""
    
    def __init__(self):
        self.session = None
        self.service = None
        self.subscriptions = {}
        self.prev_close_prices = {}
        self.current_prices = {}
        self.connected_clients: Set[WebSocketServerProtocol] = set()
        
    def initialize(self):
        """Bloomberg APIセッションを初期化"""
        try:
            # セッション設定
            sessionOptions = blpapi.SessionOptions()
            sessionOptions.setServerHost("localhost")
            sessionOptions.setServerPort(8194)
            
            self.session = blpapi.Session(sessionOptions)
            
            if not self.session.start():
                logger.error("Failed to start Bloomberg session")
                return False
                
            if not self.session.openService("//blp/mktdata"):
                logger.error("Failed to open market data service")
                return False
                
            self.service = self.session.getService("//blp/mktdata")
            logger.info("Bloomberg API initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing Bloomberg API: {e}")
            return False
    
    def get_previous_close(self, securities: List[str]) -> Dict[str, float]:
        """前日終値を取得"""
        prev_close = {}
        
        try:
            # リファレンスデータサービスを開く
            if not self.session.openService("//blp/refdata"):
                logger.error("Failed to open reference data service")
                return prev_close
                
            refDataService = self.session.getService("//blp/refdata")
            request = refDataService.createRequest("ReferenceDataRequest")
            
            # 証券を追加
            for security in securities:
                request.append("securities", security)
            
            # 前日終値フィールドを要求
            request.append("fields", "PX_CLOSE_1D")
            
            # リクエスト送信
            self.session.sendRequest(request)
            
            # レスポンス処理
            while True:
                event = self.session.nextEvent(500)
                
                for msg in event:
                    if msg.hasElement("securityData"):
                        secDataArray = msg.getElement("securityData")
                        
                        for secData in secDataArray.values():
                            security = secData.getElementAsString("security")
                            
                            if secData.hasElement("fieldData"):
                                fieldData = secData.getElement("fieldData")
                                if fieldData.hasElement("PX_CLOSE_1D"):
                                    prev_close[security] = fieldData.getElementAsFloat("PX_CLOSE_1D")
                
                if event.eventType() == blpapi.Event.RESPONSE:
                    break
                    
        except Exception as e:
            logger.error(f"Error getting previous close prices: {e}")
            
        return prev_close
    
    def subscribe_to_securities(self, securities: List[str]):
        """証券のリアルタイムデータをサブスクライブ"""
        try:
            # 前日終値を取得
            self.prev_close_prices = self.get_previous_close(securities)
            
            # サブスクリプションリストを作成
            subscriptions = blpapi.SubscriptionList()
            
            for security in securities:
                subscriptions.add(
                    security,
                    "LAST_PRICE,BID,ASK,VOLUME",
                    "",
                    blpapi.CorrelationId(security)
                )
                self.current_prices[security] = None
            
            # サブスクライブ
            self.session.subscribe(subscriptions)
            logger.info(f"Subscribed to securities: {securities}")
            
        except Exception as e:
            logger.error(f"Error subscribing to securities: {e}")
    
    def process_subscription_event(self, event):
        """サブスクリプションイベントを処理"""
        try:
            for msg in event:
                topic = msg.correlationId().value()
                
                # 現在価格を更新
                if msg.hasElement("LAST_PRICE"):
                    last_price = msg.getElementAsFloat("LAST_PRICE")
                    self.current_prices[topic] = last_price
                    
                    # 前日比変化率を計算
                    if topic in self.prev_close_prices and self.prev_close_prices[topic] > 0:
                        prev_close = self.prev_close_prices[topic]
                        change_pct = ((last_price - prev_close) / prev_close) * 100
                        
                        # WebSocketクライアントに送信するデータ
                        data = {
                            "timestamp": datetime.now().isoformat(),
                            "security": topic,
                            "last_price": last_price,
                            "prev_close": prev_close,
                            "change_pct": round(change_pct, 4),
                            "bid": msg.getElementAsFloat("BID") if msg.hasElement("BID") else None,
                            "ask": msg.getElementAsFloat("ASK") if msg.hasElement("ASK") else None,
                            "volume": msg.getElementAsInteger("VOLUME") if msg.hasElement("VOLUME") else None
                        }
                        
                        # 接続中の全クライアントにブロードキャスト
                        asyncio.create_task(self.broadcast_to_clients(data))
                        
        except Exception as e:
            logger.error(f"Error processing subscription event: {e}")
    
    async def broadcast_to_clients(self, data: dict):
        """全WebSocketクライアントにデータをブロードキャスト"""
        if self.connected_clients:
            message = json.dumps(data)
            # 切断されたクライアントを記録
            disconnected = set()
            
            for client in self.connected_clients:
                try:
                    await client.send(message)
                except websockets.exceptions.ConnectionClosed:
                    disconnected.add(client)
            
            # 切断されたクライアントを削除
            self.connected_clients -= disconnected
    
    def run_event_loop(self):
        """Bloombergイベントループを実行"""
        try:
            while True:
                event = self.session.nextEvent(500)
                
                if event.eventType() == blpapi.Event.SUBSCRIPTION_DATA:
                    self.process_subscription_event(event)
                    
        except KeyboardInterrupt:
            logger.info("Shutting down Bloomberg service...")
        except Exception as e:
            logger.error(f"Error in event loop: {e}")

# WebSocketサーバー
bloomberg_service = BloombergDataService()

async def handle_websocket(websocket: WebSocketServerProtocol, path: str):
    """WebSocket接続を処理"""
    bloomberg_service.connected_clients.add(websocket)
    logger.info(f"Client connected. Total clients: {len(bloomberg_service.connected_clients)}")
    
    try:
        async for message in websocket:
            data = json.loads(message)
            
            # クライアントからのコマンドを処理
            if data.get("action") == "subscribe":
                securities = data.get("securities", [])
                if securities:
                    bloomberg_service.subscribe_to_securities(securities)
                    await websocket.send(json.dumps({
                        "type": "subscription_confirmed",
                        "securities": securities
                    }))
            
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        bloomberg_service.connected_clients.remove(websocket)
        logger.info(f"Client disconnected. Total clients: {len(bloomberg_service.connected_clients)}")

async def run_bloomberg_in_thread():
    """Bloombergイベントループを別スレッドで実行"""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, bloomberg_service.run_event_loop)

async def main():
    """メイン実行関数"""
    # Bloomberg APIを初期化
    if not bloomberg_service.initialize():
        logger.error("Failed to initialize Bloomberg service")
        return
    
    # WebSocketサーバーを開始
    server = await websockets.serve(handle_websocket, "localhost", 8765)
    logger.info("WebSocket server started on ws://localhost:8765")
    
    # Bloombergイベントループを実行
    bloomberg_task = asyncio.create_task(run_bloomberg_in_thread())
    
    try:
        await asyncio.Future()  # 永続的に実行
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        server.close()
        await server.wait_closed()
        bloomberg_task.cancel()

if __name__ == "__main__":
    asyncio.run(main())