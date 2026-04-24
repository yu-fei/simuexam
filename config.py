import os
import json

class Config:
    def __init__(self, config_file):
        self.config_file = config_file
        self.config = self.load_config()
    
    def load_config(self):
        if not os.path.exists(self.config_file):
            raise FileNotFoundError(f"配置文件不存在: {self.config_file}")
        
        with open(self.config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def get(self, key, default=None):
        return self.config.get(key, default)
    
    @property
    def db_path(self):
        value = self.get('db_path')
        if value is None:
            raise ValueError("配置文件中缺少 'db_path' 字段")
        return value
    
    @property
    def port(self):
        value = self.get('port')
        if value is None:
            raise ValueError("配置文件中缺少 'port' 字段")
        return value
    
    @property
    def debug(self):
        return self.get('debug', False)