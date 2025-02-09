import React, {Component} from "react";
import { io, Socket } from 'socket.io-client'

import {
    statsActions,
    userinfoActions,
    transactionActions,
    settingsActions,
    socketActions,
    gachaActions,
    auctionsActions
} from '../actions/actions';
import { connect } from 'react-redux';
import { ITransaction } from "../interfaces/ITransaction";
import { IWallet } from "../interfaces/IWallet";
import { ICoinDataCollection, ICoinInfo } from "../interfaces/ICoinInfo";
import { UserItems, IItemCatalogue, IItem } from '../interfaces/IItem';
import checkStorage from '../checkStorage';
import { IAuctionItem, IAuctionFeedItem, IAuctionHistoryEntry, IAuctionNotificationItem } from "./auctions/IAuction";

const mapStateToProps = (state:any, props:any) => ({
    session: state.session,
    userinfo: state.userinfo,
    stats: state.stats,
    socket: state.socket,
    itemcatalogue: state.itemcatalogue,
    auctions: state.auctions
});

const mapDispatchToProps = {
    setStats: statsActions.setStats,
    setHistory: statsActions.setHistory,
    setCoinInfo: statsActions.setCoinInfo,
    setTodayPrices: statsActions.setTodayPrices,
    setLeaderboard: statsActions.setLeaderboard,
    setOshiboard: statsActions.setOshiboard,
    addTransaction: transactionActions.addTransaction,
    setWallet: userinfoActions.setWallet,
    setMarketSwitch: settingsActions.setMarketSwitch,
    setItems: userinfoActions.setItems,
    setSocket: socketActions.setSocket,
    removeSocket: socketActions.removeSocket,
    setReceivedItems: gachaActions.setReceivedItems,
    setBrokerTotal: statsActions.setBrokerTotal,
    setBrokerFeeTotal: userinfoActions.setBrokerFeeTotal,
    setBrokerFeeCredits: userinfoActions.setBrokerFeeCredits,
    setActiveAuctions: auctionsActions.setActiveAuctions,
    setPastAuctions: auctionsActions.setPastAuctions,
    setAuctionPriceHistory: auctionsActions.setAuctionPriceHistory,
    setAuctionFeeds: auctionsActions.setAuctionFeeds,
    setAuctionNotifications: auctionsActions.setAuctionNotifications
}

interface SocketHandlerProps {
    session: {
        loggedin: boolean
    },
    userinfo: {
        id:string,
        wallet: IWallet,
        items: UserItems,
        brokerFeeTotal: number,
        brokerFeeCredits: number
    },
    stats: {
        coinInfo:ICoinDataCollection,
        coinHistory:any,
        stats:any,
        brokerTotal:number
    },
    socket: {
        socket: any,
        query: any
    },
    auctions: {
        activeAuctions: Array<IAuctionItem>,
        auctionFeeds: {},
        pastAuctions: Array<IAuctionHistoryEntry>,
        auctionPriceHistory: {},
        subscriptions: Array<string>,
        auctionNotifications: Array<IAuctionNotificationItem>
    },
    itemcatalogue: IItemCatalogue,
    setStats: (stats:{}) => {},
    setHistory: (coinHistory:{}) => {},
    setCoinInfo: (coinInfo: {}) => {},
    setTodayPrices: (todayPrices:{}) => {},
    setLeaderboard: (leaderboard:{}) => {},
    setOshiboard: (oshiboard:{}) => {}
    
    setWallet: (wallet:any) => {},
    addTransaction: (transaction:ITransaction) => {},
    
    setMarketSwitch: (open:boolean) => {},
    
    setItems: (items:any) => {},
    setSocket: (socket:any) => {},
    removeSocket: () => {},
    
    setReceivedItems: (receivedItems:Array<string>) => {},
    
    setBrokerTotal: (brokerTotal:number) => {},
    setBrokerFeeTotal: (brokerFeeTotal:number) => {},
    setBrokerFeeCredits: (brokerFeeCredits:number) => {}
    
    setActiveAuctions: (activeAuctions:any) => {},
    setAuctionFeeds: (auctionFeeds:any) => {},
    setPastAuctions: (pastAuctions:any) => {},
    setAuctionPriceHistory: (auctionPriceHistory:any) => {},
    setAuctionNotifications: (auctionNotifications:any) => {}
}

class SocketHandlerBind extends Component<SocketHandlerProps> {
	
    reconnect() {
        let s = this.props.socket.socket;
        if(s !== null) s.disconnect();

        let loggedin = false;
        if(
            this.props.session.loggedin && 
            this.props.userinfo.id !== undefined) {   
            loggedin = true;
        }

        let query = {...this.props.socket.query};
        if(loggedin) {
            query.user = this.props.userinfo.id
        }

        //const socketUrl = 'http://localhost:3500';
        //const socketPath = '';
        const socketUrl = 'https://nasfaq.biz';
        const socketPath = '/socket';
        let newSocket = io(socketUrl, {
            path: socketPath,
            query
        });
        
        this.listenData(newSocket);
        if(loggedin) this.listenTransaction(newSocket);

        this.props.setSocket(newSocket);
    }

    componentDidUpdate(prevProps:SocketHandlerProps) {
        if(
            prevProps.session.loggedin !== this.props.session.loggedin ||
            prevProps.socket.query !== this.props.socket.query) {
                this.reconnect();
            }
    }

    listenTransaction(socket:Socket) {
        socket.on('transactionUpdate', (data:any) => {
            let transactions:Array<ITransaction> = data.transactions;
            transactions.forEach((t:ITransaction) => {
                this.props.addTransaction(t);
            })
            if(data.wallet !== null) {
                this.props.setWallet(data.wallet);
            }
        })
    }

    parseCoinInfo(data:any) {
        let coinInfo = {...this.props.stats.coinInfo};
        let coinData = coinInfo.data[data.coin];
        if(coinData === undefined) return;
        coinData.inCirculation = data.info.inCirculation;
        coinData.price = data.info.price;
        coinData.saleValue = data.info.saleValue;

        coinInfo.data[data.coin] = coinData;
        this.props.setCoinInfo(coinInfo);
    }

    addHistoryItem(info:ICoinInfo) {
        let history = {...this.props.stats.coinHistory};
        let date = new Date(info.timestamp).toLocaleDateString();
        Object.keys(info.data).forEach((coin:string) => {
            if(history[coin] === undefined) {
                history[coin] = {
                    labels:[],
                    inCirculation:[],
                    price:[]
                }
            }
            history[coin].labels.push(date);
            history[coin].inCirculation.push(info.data[coin].inCirculation);
            history[coin].price.push(info.data[coin].price);
        })
        this.props.setHistory(history);
        if(checkStorage()) {
            let cachedStatsString = localStorage.getItem("nasfaq:stats");
            if(cachedStatsString === null) {
                let newStats = {
                    timestamp:new Date().getTime(),
                    stats:this.props.stats.stats, 
                    history
                }
                localStorage.setItem("nasfaq:stats", JSON.stringify(newStats));
            } else {
                let cachedStats = JSON.parse(cachedStatsString);
                cachedStats.timestamp = new Date().getTime();
                cachedStats.history = history;
                localStorage.setItem("nasfaq:stats", JSON.stringify(cachedStats));
            }
        }
    }

    parsePriceUpdate(data:any) {
        let coinInfo:ICoinDataCollection = {...this.props.stats.coinInfo};
        let history = [...coinInfo.data[data.coin].history];
        history.push(data.priceStamp);
        coinInfo.data[data.coin].history = history;
        this.props.setCoinInfo(coinInfo);
    }

    appendStatisticsUpdate(data:any) {
        let oldStats:any = {...this.props.stats.stats};
        Object.keys(data).forEach((coin:string) => {
            if(oldStats[coin] === undefined) {
                oldStats[coin] = {}
                Object.keys(data[coin]).forEach((stat:string) => {
                    oldStats[coin][stat] = {
                        name:stat,
                        data:[],
                        labels:[]
                    }
                })
            }
        })
        Object.keys(oldStats).forEach((coin:string) => {
            let coinStats:any = oldStats[coin];
            Object.keys(coinStats).forEach((statType:string) => {

                let newData = data[coin][statType].data[0];
                let newLabel = data[coin][statType].labels[0];
                oldStats[coin][statType].data.push(newData);
                oldStats[coin][statType].labels.push(newLabel);

            })
        })
        this.props.setStats(oldStats);
        if(checkStorage()) {
            let cachedStatsString = localStorage.getItem("nasfaq:stats");
            if(cachedStatsString === null) {
                let newStats = {
                    timestamp:new Date().getTime(),
                    stats:oldStats, 
                    history:this.props.stats.coinHistory
                }
                localStorage.setItem("nasfaq:stats", JSON.stringify(newStats));
            } else {
                let cachedStats = JSON.parse(cachedStatsString);
                cachedStats.timestamp = new Date().getTime();
                cachedStats.stats = oldStats;
                localStorage.setItem("nasfaq:stats", JSON.stringify(cachedStats));
            }
        }
    }

    gachaUpdate(d:Array<string>, cashDrops:number) {
        
        let drops = d.filter((item:string) => {
            return item !== 'Nothing'
        });
        let catalogue = {...this.props.itemcatalogue};
        let userItems = {...this.props.userinfo.items};
        for(let i = 0; i < drops.length; i++) {
            let itemName = drops[i];
            let itemClass = catalogue[itemName].modifier;
            let ownsItem = false;
            if(userItems[itemClass] !== undefined) {
                userItems[itemClass].forEach((i:IItem) => {
                    if(i.itemType === itemName) {
                        i.quantity++;
                        ownsItem = true;
                    }
                })
            } else {
                userItems[itemClass] = [];
            }
            if(!ownsItem) {
                let newItem:IItem = {
                    itemType:itemName,
                    acquiredTimestamp: new Date().getTime(),
                    lastPurchasePrice:0,
                    quantity:1
                };
                userItems[itemClass].push(newItem);
            }
        }
        for(let i = 0; i < cashDrops; i++) {
            drops.push('Cash');
        }
        this.props.setReceivedItems(drops);
        this.props.setItems(userItems);
    }

    listenData(socket:Socket) {
        socket.on('coinPriceUpdate', (data:any) => {
            this.parseCoinInfo(data);
        })
        
        socket.on('statisticsUpdate', (data:any) => {
            this.appendStatisticsUpdate(JSON.parse(data));
        })
        
        socket.on('coinHistoryUpdate', (data:any) => {
            this.addHistoryItem(JSON.parse(data));
        })

        socket.on('todayPricesUpdate', (data:any) => {
            this.parsePriceUpdate(JSON.parse(data));
        })

        socket.on('leaderboardUpdate', (data:any) => {
            let boards = JSON.parse(data);
            this.props.setLeaderboard(boards.leaderboard.leaderboard);
            this.props.setOshiboard(boards.oshiboard);
        })

        socket.on('oshiboardUpdate', (data:any) => {
            this.props.setOshiboard(JSON.parse(data))
        })

        socket.on('dividendUpdate', (data:any) => {
            this.props.setWallet(data);
        })

        socket.on('marketSwitch', (data:any) => {
            this.props.setMarketSwitch(data);
        })

        socket.on('itemsUpdate', (data:any) => {
            this.props.setItems(data);
        })

        socket.on('gachaUpdate', (data:any) => {
            this.gachaUpdate(data.drops, data.cashDrops);
        })

        socket.on('brokerFeeUpdate', (data:any) => {
            let d = JSON.parse(data);
            let amount = d.amount;
            if(d.userid === this.props.userinfo.id) {
                this.props.setBrokerFeeTotal(Math.round((this.props.userinfo.brokerFeeTotal + amount) * 100) / 100);
            }
            this.props.setBrokerTotal(Math.round((this.props.stats.brokerTotal + amount) * 100) / 100);
        })

        socket.on('creditsUpdate', (data:any) => {
            this.props.setBrokerFeeCredits(Math.round((this.props.userinfo.brokerFeeCredits + data.amount) * 100) / 100);
        })

        socket.on('walletUpdate', (data:any) => {

            const wallet:IWallet = JSON.parse(data).wallet;
            this.props.setWallet(wallet);
        })

        socket.on('auctionUpdate', (data:any) => {

            const message = JSON.parse(data);
            const auction:IAuctionItem = message.auction;
            const updateType:string = message.type;

            let activeAuctions = [...this.props.auctions.activeAuctions];

            if(updateType === "newAuction") {
                activeAuctions.push(auction);
            } else {
                for(let i = 0; i < activeAuctions.length; i++) {
                    if(activeAuctions[i].auctionID === auction.auctionID) {
                        if(updateType === 'removeAuction' || updateType === 'completeAuction') {
                            activeAuctions.splice(i, 1);
                        } else {
                            activeAuctions[i] = auction;
                        }
                        break;
                    }
                }
            }
            this.props.setActiveAuctions(activeAuctions);

            if(updateType === 'completeAuction') {
                let auctionHistoryEntry:IAuctionHistoryEntry = {
                    expiration:auction.expiration,
                    sellerID:auction.sellerid,
                    seller:auction.seller,
                    bidder:auction.bidder,
                    bidderID:auction.bidderid,
                    amount:auction.amount,
                    currentBid:auction.currentBid,
                    item:auction.item
                }

                let pastAuctions = [auctionHistoryEntry, ...this.props.auctions.pastAuctions];
                let auctionPriceHistory:any = {...this.props.auctions.auctionPriceHistory};

                this.props.setPastAuctions(pastAuctions);

                if(auctionPriceHistory[auction.item] === undefined) {
                    auctionPriceHistory[auction.item] = []
                }
                auctionPriceHistory[auction.item].push(auction.currentBid);
                this.props.setAuctionPriceHistory(auctionPriceHistory);
            }

            if(updateType === 'newBid') {
                let auctionFeeds:any = {...this.props.auctions.auctionFeeds};
                let feedItem:IAuctionFeedItem = {
                    username: auction.bidder,
                    amount: auction.currentBid,
                    timestamp: new Date().getTime()
                }
                if(auctionFeeds[auction.auctionID] === undefined) {
                    auctionFeeds[auction.auctionID] = [feedItem];
                } else {
                    auctionFeeds[auction.auctionID].push(feedItem);
                }
                this.props.setAuctionFeeds(auctionFeeds);

                if(this.props.auctions.subscriptions.indexOf(auction.auctionID) !== -1) {
                    let auctionNotification:IAuctionNotificationItem = {
                        seller:auction.seller,
                        bidder:auction.bidder,
                        amount:auction.amount,
                        bid:auction.currentBid,
                        item:auction.item,
                        timestamp: new Date().getTime()
                    }
                    let auctionNotifications:Array<IAuctionNotificationItem> = [
                        ...this.props.auctions.auctionNotifications,
                        auctionNotification
                    ];
                    this.props.setAuctionNotifications(auctionNotifications);
                }


            }


        })
    }

    componentDidMount() {
        this.reconnect();
    }

    componentWillUnmount() {
		let s = this.props.socket.socket;
		if(s !== null) s.disconnect();
        this.props.removeSocket();
    }

    render() {
        return <div></div>;
    }
}

const SocketHandler = connect(
	mapStateToProps,
	mapDispatchToProps
)(SocketHandlerBind);

export default SocketHandler;
