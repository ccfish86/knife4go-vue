<template>
  <a-layout-content class="knife4j-body-content">
    <div class="authorize">
      <a-row>
        <a-button type="primary" @click="resetAuth">{{ $t('auth.cancel') }}</a-button>
      </a-row>
      <!--通用security认证参数(header/query)-->
      <a-row v-if="securityKeyFlag" style="margin-top:15px;">
        <a-table size="small" :rowKey="record => record.id || record.key" :columns="columns" :dataSource="securityArr"
                 :pagination="pagination" bordered>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'key'">
              <span>{{ record.key }}({{ record.type }})</span>
            </template>
            <template v-else-if="column.dataIndex === 'value'">
              <a-input :value="record.value" @change="e => authParamChange(e, record)" allowClear/>
            </template>
          </template>
        </a-table>
      </a-row>
      <!--OAuth2认证-->
      <a-row v-if="oauthFlag && oauth" style="margin-top:15px;">
        <a-card title="OAuth2">
          <a-row>
            <a-col :span="4">Flow</a-col>
            <a-col :span="18">
              <a-input :value="oauth.grantType" readonly/>
            </a-col>
          </a-row>
          <a-row v-if="showAuthorizationUrl" style="margin-top:15px;">
            <a-col :span="4">Authorization URL</a-col>
            <a-col :span="18">
              <a-input :value="oauth.authorizeUrl" readonly/>
            </a-col>
          </a-row>
          <a-row v-if="showTokenUrl" style="margin-top:15px;">
            <a-col :span="4">Token URL</a-col>
            <a-col :span="18">
              <a-input :value="oauth.tokenUrl" readonly/>
            </a-col>
          </a-row>
          <a-row v-if="isPassword" style="margin-top:15px;">
            <a-col :span="4">username</a-col>
            <a-col :span="18">
              <a-input :value="oauth.username" @change="e => oauth.username = e.target.value" allowClear/>
            </a-col>
          </a-row>
          <a-row v-if="isPassword" style="margin-top:15px;">
            <a-col :span="4">password</a-col>
            <a-col :span="18">
              <a-input-password :value="oauth.password" @change="e => oauth.password = e.target.value"/>
            </a-col>
          </a-row>
          <a-row style="margin-top:15px;">
            <a-col :span="4">clientId</a-col>
            <a-col :span="18">
              <a-input :value="oauth.clientId" @change="e => oauth.clientId = e.target.value" allowClear/>
            </a-col>
          </a-row>
          <a-row v-if="showClientSecret" style="margin-top:15px;">
            <a-col :span="4">clientSecret</a-col>
            <a-col :span="18">
              <a-input-password :value="oauth.clientSecret" @change="e => oauth.clientSecret = e.target.value"/>
            </a-col>
          </a-row>
          <a-row style="margin-top:15px;">
            <a-col :span="4"></a-col>
            <a-col :span="18">
              <a-button type="primary" @click="auth">Authorize</a-button>
            </a-col>
          </a-row>
        </a-card>
      </a-row>
    </div>
  </a-layout-content>
</template>
<script>
import constant from "@/store/constants";
import KUtils from "@/core/utils";
import localStore from "@/store/local.js";
import { useGlobalsStore } from '@/store/modules/global.js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import axios from 'axios'
import qs from 'qs'

export default {
  name: "Authorize",
  props: {
    data: {
      type: Object
    }
  },
  setup() {
    const store = useGlobalsStore()
    const { messages } = useI18n()
    return {
      messages,
      language: computed(() => store.language),
      swaggerCurrentInstance: computed(() => store.swaggerCurrentInstance)
    }
  },
  data() {
    return {
      pagination: false,
      columns: [],
      // 当前分组是否存在通用security参数
      securityKeyFlag: false,
      // 是否存在OAuth2认证
      oauthFlag: false,
      oauth: null,
      // 当前swagger实例对象
      instance: null,
      // 全局的security参数,id -> value
      globalSecurityObject: {},
      // 当前分组下需要填充的security参数
      securityArr: []
    };
  },
  computed: {
    isImplicit() {
      return !!this.oauth && this.oauth.grantType === 'implicit';
    },
    // OAS2:accessCode,OAS3:authorizationCode
    isAuthorizationCode() {
      return !!this.oauth && (this.oauth.grantType === 'accessCode' || this.oauth.grantType === 'authorizationCode');
    },
    isPassword() {
      return !!this.oauth && this.oauth.grantType === 'password';
    },
    // OAS2:application/client_credentials,OAS3:clientCredentials
    isClientCredentials() {
      return !!this.oauth && ['application', 'client_credentials', 'clientCredentials'].includes(this.oauth.grantType);
    },
    showAuthorizationUrl() {
      return this.isAuthorizationCode || this.isImplicit;
    },
    showTokenUrl() {
      return this.isPassword || this.isClientCredentials;
    },
    // 简化模式不需要clientSecret
    showClientSecret() {
      return !this.isImplicit;
    }
  },
  watch: {
    language: function () {
      this.initI18n();
    },
    // 面板创建时实例尚未就绪(如分组切换后重新激活Tab)的场景,实例就绪后再初始化一次
    swaggerCurrentInstance: function (val) {
      if (!this.instance && val) {
        this.instance = val;
        this.initLocalSecuritys();
      }
    }
  },
  created() {
    // 面板中的instance实例,兜底取当前swagger实例
    this.instance = (this.data && this.data.instance) || this.swaggerCurrentInstance;
    this.initI18n();
    this.initLocalSecuritys();
  },
  mounted() {
    // OAuth2回调页在其它窗口完成授权后,回到当前窗口时同步一次授权状态
    this.handleWindowFocus = () => {
      if (this.oauth && typeof this.oauth.sync === 'function') {
        this.oauth.sync();
      }
    };
    window.addEventListener('focus', this.handleWindowFocus);
  },
  beforeUnmount() {
    if (this.handleWindowFocus) {
      window.removeEventListener('focus', this.handleWindowFocus);
      this.handleWindowFocus = null;
    }
  },
  methods: {
    getCurrentI18nInstance() {
      return this.messages[this.language];
    },
    initI18n() {
      const inst = this.getCurrentI18nInstance();
      const cols = (inst && inst.table && inst.table.authHeaderColumns) || [];
      // vue3下表格不再使用scopedSlots,参数值列的输入框由#bodyCell渲染
      this.columns = cols.map(col => {
        return {
          title: col.title,
          dataIndex: col.dataIndex,
          className: col.className
        };
      });
    },
    initLocalOAuth() {
      if (!this.instance) {
        return;
      }
      const oauths = this.instance.oauths;
      if (KUtils.checkUndefined(oauths)) {
        this.oauthFlag = true;
        this.oauth = oauths;
        // 从本地缓存同步已授权状态(回调页返回或者之前授权的结果)
        if (typeof oauths.sync === 'function') {
          oauths.sync();
        }
      }
    },
    async initLocalSecuritys() {
      this.initLocalOAuth();
      if (!this.instance) {
        return;
      }
      const backArr = this.instance.securityArrs;
      if (KUtils.arrNotEmpty(backArr)) {
        this.securityKeyFlag = true;
      }
      // 前缀+实例id
      const key = constant.globalSecurityParamPrefix + this.instance.id;
      // 全局通用的security参数
      const gbp = await localStore.getItem(constant.globalSecurityParameterObject);
      if (!KUtils.arrNotEmpty(backArr)) {
        return;
      }
      // 读取本分组下的security
      const currentSecurity = await localStore.getItem(key);
      let tmpSecuritys = [];
      if (KUtils.checkUndefined(currentSecurity)) {
        // 当前分组不为空
        // 需要对比后端最新的参数情况,后端有可能已经删除参数
        backArr.forEach(security => {
          // 判断当前的key在缓存中是否存在
          const caches = currentSecurity.filter(se => se.id == security.id);
          if (caches.length > 0) {
            // 存在
            if (KUtils.strNotBlank(security.value)) {
              tmpSecuritys.push(security);
            } else {
              tmpSecuritys.push(caches[0]);
            }
          } else {
            tmpSecuritys.push(security);
          }
        });
      } else {
        tmpSecuritys = backArr;
      }
      this.securityArr = tmpSecuritys;
      // 当前分组下的security不为空,判断全局分组,兼容升级的情况下,gbp可能会存在为空或者为数组的情况
      if (KUtils.checkUndefined(gbp)) {
        this.globalSecurityObject = Array.isArray(gbp) ? {} : gbp;
        // 从全局参数中更新当前分组下的参数
        this.securityArr.forEach(selfSecurity => {
          const globalValueTmp = gbp[selfSecurity.id];
          if (KUtils.checkUndefined(globalValueTmp)) {
            // id相等,更新value值
            selfSecurity.value = globalValueTmp;
          } else {
            this.globalSecurityObject[selfSecurity.id] = selfSecurity.value;
          }
        });
      } else {
        // 为空的情况下,则默认直接新增当前分组下的security
        this.securityArr.forEach(sa => {
          this.globalSecurityObject[sa.id] = sa.value;
        });
      }
      this.storeToLocalIndexDB();
    },
    storeToLocalIndexDB() {
      if (!this.instance) {
        return;
      }
      // 前缀+实例id
      const key = constant.globalSecurityParamPrefix + this.instance.id;
      // 更新当前实例下的securitys
      localStore.setItem(key, this.securityArr);
      // 更新全局的securitys
      localStore.setItem(constant.globalSecurityParameterObject, this.globalSecurityObject);
    },
    authParamChange(e, record) {
      record.value = e.target.value;
      // 同步更新全局参数
      this.globalSecurityObject[record.id] = record.value;
      this.storeToLocalIndexDB();
    },
    resetAuth() {
      if (this.oauthFlag) {
        this.resetOAuth2();
      }
      if (this.securityKeyFlag) {
        this.resetCommonSecurtyAuth();
      }
      message.info('SUCCESS');
    },
    resetOAuth2() {
      if (this.oauth && typeof this.oauth.clear === 'function') {
        this.oauth.clear();
      }
    },
    resetCommonSecurtyAuth() {
      if (!KUtils.arrNotEmpty(this.securityArr)) {
        return;
      }
      this.securityArr.forEach(security => {
        security.value = '';
        this.globalSecurityObject[security.id] = '';
      });
      this.storeToLocalIndexDB();
    },
    /**
     * 计算OAuth2的回调地址
     * 开发环境回调页是public/oauth/oauth2.html,打包后跟随webjars目录
     */
    getOAuth2RedirectUri() {
      const location = window.location;
      let path = location.pathname;
      // 去掉doc.html之类的页面名,得到部署的上下文目录
      path = path.substring(0, path.lastIndexOf('/') + 1);
      return location.origin + path + KUtils.getOAuth2Html(import.meta.env.PROD);
    },
    async auth() {
      const oauth = this.oauth;
      if (!oauth) {
        return false;
      }
      if (this.isPassword) {
        if (KUtils.strBlank(oauth.username)) {
          message.info("username can't empty!!!");
          return false;
        }
        if (KUtils.strBlank(oauth.password)) {
          message.info("password can't empty!!!");
          return false;
        }
      }
      if (KUtils.strBlank(oauth.clientId)) {
        message.info("clientId can't empty!!!");
        return false;
      }
      if (this.showClientSecret && KUtils.strBlank(oauth.clientSecret)) {
        message.info("clientSecret can't empty!!!");
        return false;
      }
      if (this.isImplicit || this.isAuthorizationCode) {
        // 简化模式/授权码模式,跳转到授权页面,授权结果由oauth2.html回调页写回本地缓存
        const redirectUri = encodeURIComponent(this.getOAuth2RedirectUri());
        oauth.redirectUri = redirectUri;
        let openUrl = oauth.authorizeUrl || '';
        const params = [];
        params.push("response_type=" + (this.isImplicit ? "token" : "code"));
        params.push("client_id=" + oauth.clientId);
        params.push("redirect_uri=" + redirectUri);
        // state的值即为oauth2.html回调页从本地缓存中读取授权对象的key
        params.push("state=SELF" + oauth.state);
        const paramUrl = params.join("&");
        if (openUrl.indexOf("?") >= 0) {
          openUrl = openUrl + "&" + paramUrl;
        } else {
          openUrl = openUrl + "?" + paramUrl;
        }
        // 授权前先把当前oauth对象写入本地缓存,回调页需要读取tokenUrl、clientId等参数
        if (typeof oauth.sync === 'function') {
          oauth.sync();
        }
        window.open(openUrl);
      } else if (this.isPassword) {
        // 密码模式
        const formData = {
          "grant_type": "password",
          "username": oauth.username,
          "password": oauth.password
        };
        await this.requestAccessToken(formData);
      } else if (this.isClientCredentials) {
        // 客户端模式
        const formData = {
          "grant_type": "client_credentials"
        };
        await this.requestAccessToken(formData);
      }
    },
    async requestAccessToken(formData) {
      const oauth = this.oauth;
      const requestConfig = {
        url: oauth.tokenUrl,
        method: "post",
        auth: {
          username: oauth.clientId,
          password: oauth.clientSecret
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        params: null,
        timeout: 0,
        data: qs.stringify(formData)
      };
      try {
        const res = await axios.create().request(requestConfig);
        // 先同步历史缓存中的clientId等参数
        if (typeof oauth.sync === 'function') {
          oauth.sync();
        }
        this.applyHignSecurityVersion(res.data);
        oauth.granted = true;
        // sync()会以本地缓存为准,授权成功后需要以最新授权结果重新落盘
        this.saveOAuth2Cache();
        message.info("SUCCESS");
      } catch (err) {
        if (err.response) {
          console.log(err);
        } else {
          message.error(err.message);
        }
      }
    },
    /**
     * 将当前oauth对象写入本地缓存,key规则与SwaggerBootstrapUiOAuth2.prototype.sync保持一致,
     * oauth2.html回调页也是根据该key读取授权参数
     */
    saveOAuth2Cache() {
      if (!window.localStorage || !this.oauth) {
        return;
      }
      const key = 'SELF' + this.oauth.state;
      window.localStorage.setItem(key, KUtils.json5stringify(this.oauth));
    },
    applyHignSecurityVersion(data) {
      // 兼容高版本security针对oauth授权后字段变更
      // https://gitee.com/xiaoym/knife4j/issues/I4TI9V
      if (KUtils.checkUndefined(data)) {
        if (KUtils.checkUndefined(data.token_type)) {
          this.oauth.accessToken = data.token_type + " " + data.access_token;
          this.oauth.tokenType = data.token_type;
        } else if (KUtils.checkUndefined(data.tokenType)) {
          this.oauth.accessToken = data.tokenType + " " + data.value;
          this.oauth.tokenType = data.tokenType;
        }
      }
    }
  }
};
</script>

<style scoped>
.authorize {
  margin: 30px auto;
  width: 98%;
}
</style>
